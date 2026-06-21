import { Router, type IRouter } from "express";
import { eq, and, count, inArray } from "drizzle-orm";
import { db, showApprovalsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { getGroupMemberIds, getMembership } from "../lib/groups";
import {
  ListApprovalsQueryParams,
  ListApprovalsResponse,
  SetApprovalBody,
  SetApprovalResponse,
  ClearApprovalQueryParams,
  ClearApprovalResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

const APPROVALS = ["yes", "no", "solo"] as const;
type ApprovalValue = (typeof APPROVALS)[number];

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

// Returns the member ids whose answers count toward a show's tallies for this
// caller: just the caller unless they pass a group they belong to.
async function tallyMemberIds(
  callerId: string,
  groupId: number | undefined,
): Promise<string[]> {
  if (groupId === undefined) return [callerId];
  const membership = await getMembership(groupId, callerId);
  if (!membership) return [callerId];
  return getGroupMemberIds(groupId);
}

async function summarizeShow(
  memberIds: string[],
  callerId: string,
  titleKey: string,
  mediaType: string,
) {
  const rows = await db
    .select({ approval: showApprovalsTable.approval })
    .from(showApprovalsTable)
    .where(
      and(
        inArray(showApprovalsTable.userId, memberIds),
        eq(showApprovalsTable.titleKey, titleKey),
        eq(showApprovalsTable.mediaType, mediaType),
      ),
    );

  const counts = { yes: 0, no: 0, solo: 0 };
  for (const r of rows) {
    if (r.approval === "yes" || r.approval === "no" || r.approval === "solo") {
      counts[r.approval] += 1;
    }
  }

  const [mine] = await db
    .select({ approval: showApprovalsTable.approval })
    .from(showApprovalsTable)
    .where(
      and(
        eq(showApprovalsTable.userId, callerId),
        eq(showApprovalsTable.titleKey, titleKey),
        eq(showApprovalsTable.mediaType, mediaType),
      ),
    );

  const myApproval =
    mine?.approval === "yes" ||
    mine?.approval === "no" ||
    mine?.approval === "solo"
      ? (mine.approval as ApprovalValue)
      : null;

  return { titleKey, mediaType, ...counts, myApproval };
}

router.get("/approvals", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListApprovalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const memberIds = await tallyMemberIds(callerId, parsed.data.groupId);

  const grouped = await db
    .select({
      titleKey: showApprovalsTable.titleKey,
      mediaType: showApprovalsTable.mediaType,
      approval: showApprovalsTable.approval,
      value: count(),
    })
    .from(showApprovalsTable)
    .where(inArray(showApprovalsTable.userId, memberIds))
    .groupBy(
      showApprovalsTable.titleKey,
      showApprovalsTable.mediaType,
      showApprovalsTable.approval,
    );

  const mine = await db
    .select({
      titleKey: showApprovalsTable.titleKey,
      mediaType: showApprovalsTable.mediaType,
      approval: showApprovalsTable.approval,
    })
    .from(showApprovalsTable)
    .where(eq(showApprovalsTable.userId, callerId));

  const key = (titleKey: string, mediaType: string) =>
    `${titleKey}::${mediaType}`;

  const byShow = new Map<
    string,
    {
      titleKey: string;
      mediaType: string;
      yes: number;
      no: number;
      solo: number;
      myApproval: ApprovalValue | null;
    }
  >();

  for (const row of grouped) {
    const k = key(row.titleKey, row.mediaType);
    let show = byShow.get(k);
    if (!show) {
      show = {
        titleKey: row.titleKey,
        mediaType: row.mediaType,
        yes: 0,
        no: 0,
        solo: 0,
        myApproval: null,
      };
      byShow.set(k, show);
    }
    if (
      row.approval === "yes" ||
      row.approval === "no" ||
      row.approval === "solo"
    ) {
      show[row.approval] = row.value;
    }
  }

  for (const m of mine) {
    const show = byShow.get(key(m.titleKey, m.mediaType));
    if (
      show &&
      (m.approval === "yes" || m.approval === "no" || m.approval === "solo")
    ) {
      show.myApproval = m.approval;
    }
  }

  res.json(ListApprovalsResponse.parse(Array.from(byShow.values())));
});

router.put("/approvals", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = SetApprovalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const titleKey = normalizeTitle(parsed.data.title);
  const { mediaType, approval } = parsed.data;

  await db
    .insert(showApprovalsTable)
    .values({ userId: callerId, titleKey, mediaType, approval })
    .onConflictDoUpdate({
      target: [
        showApprovalsTable.userId,
        showApprovalsTable.titleKey,
        showApprovalsTable.mediaType,
      ],
      set: { approval, updatedAt: new Date() },
    });

  const memberIds = await tallyMemberIds(callerId, parsed.data.groupId);
  const summary = await summarizeShow(memberIds, callerId, titleKey, mediaType);
  res.json(SetApprovalResponse.parse(summary));
});

router.delete("/approvals", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ClearApprovalQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const titleKey = normalizeTitle(parsed.data.title);
  const { mediaType } = parsed.data;

  await db
    .delete(showApprovalsTable)
    .where(
      and(
        eq(showApprovalsTable.userId, callerId),
        eq(showApprovalsTable.titleKey, titleKey),
        eq(showApprovalsTable.mediaType, mediaType),
      ),
    );

  const memberIds = await tallyMemberIds(callerId, parsed.data.groupId);
  const summary = await summarizeShow(memberIds, callerId, titleKey, mediaType);
  res.json(ClearApprovalResponse.parse(summary));
});

export default router;
