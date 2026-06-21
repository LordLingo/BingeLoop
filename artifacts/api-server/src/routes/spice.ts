import { Router, type IRouter } from "express";
import { eq, and, count, inArray } from "drizzle-orm";
import { db, showSpiceTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { getGroupMemberIds, getMembership } from "../lib/groups";
import {
  ListSpiceQueryParams,
  ListSpiceResponse,
  SetSpicyBody,
  SetSpicyResponse,
  ClearSpicyQueryParams,
  ClearSpicyResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

const SPICY_VALUES = ["yes", "no"] as const;
type SpicyValue = (typeof SPICY_VALUES)[number];

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

// Returns the member ids whose answers count toward a show's tallies for this
// caller: just the caller when no group is given, or all members of the group.
// Returns null when the caller passed a group they don't belong to, so the
// route can respond with a 403 (consistent with /entries and /stats).
async function resolveMemberIds(
  callerId: string,
  groupId: number | undefined,
): Promise<string[] | null> {
  if (groupId === undefined) return [callerId];
  const membership = await getMembership(groupId, callerId);
  if (!membership) return null;
  return getGroupMemberIds(groupId);
}

async function summarizeShow(
  memberIds: string[],
  callerId: string,
  titleKey: string,
  mediaType: string,
) {
  const rows = await db
    .select({ spicy: showSpiceTable.spicy })
    .from(showSpiceTable)
    .where(
      and(
        inArray(showSpiceTable.userId, memberIds),
        eq(showSpiceTable.titleKey, titleKey),
        eq(showSpiceTable.mediaType, mediaType),
      ),
    );

  const counts = { yes: 0, no: 0 };
  for (const r of rows) {
    if (r.spicy === "yes" || r.spicy === "no") {
      counts[r.spicy] += 1;
    }
  }

  const [mine] = await db
    .select({ spicy: showSpiceTable.spicy })
    .from(showSpiceTable)
    .where(
      and(
        eq(showSpiceTable.userId, callerId),
        eq(showSpiceTable.titleKey, titleKey),
        eq(showSpiceTable.mediaType, mediaType),
      ),
    );

  const mySpicy =
    mine?.spicy === "yes" || mine?.spicy === "no"
      ? (mine.spicy as SpicyValue)
      : null;

  return { titleKey, mediaType, ...counts, mySpicy };
}

router.get("/spice", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListSpiceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const memberIds = await resolveMemberIds(callerId, parsed.data.groupId);
  if (memberIds === null) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  const grouped = await db
    .select({
      titleKey: showSpiceTable.titleKey,
      mediaType: showSpiceTable.mediaType,
      spicy: showSpiceTable.spicy,
      value: count(),
    })
    .from(showSpiceTable)
    .where(inArray(showSpiceTable.userId, memberIds))
    .groupBy(
      showSpiceTable.titleKey,
      showSpiceTable.mediaType,
      showSpiceTable.spicy,
    );

  const mine = await db
    .select({
      titleKey: showSpiceTable.titleKey,
      mediaType: showSpiceTable.mediaType,
      spicy: showSpiceTable.spicy,
    })
    .from(showSpiceTable)
    .where(eq(showSpiceTable.userId, callerId));

  const key = (titleKey: string, mediaType: string) =>
    `${titleKey}::${mediaType}`;

  const byShow = new Map<
    string,
    {
      titleKey: string;
      mediaType: string;
      yes: number;
      no: number;
      mySpicy: SpicyValue | null;
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
        mySpicy: null,
      };
      byShow.set(k, show);
    }
    if (row.spicy === "yes" || row.spicy === "no") {
      show[row.spicy] = row.value;
    }
  }

  for (const m of mine) {
    const show = byShow.get(key(m.titleKey, m.mediaType));
    if (show && (m.spicy === "yes" || m.spicy === "no")) {
      show.mySpicy = m.spicy;
    }
  }

  res.json(ListSpiceResponse.parse(Array.from(byShow.values())));
});

router.put("/spice", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = SetSpicyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const titleKey = normalizeTitle(parsed.data.title);
  const { mediaType, spicy } = parsed.data;

  const memberIds = await resolveMemberIds(callerId, parsed.data.groupId);
  if (memberIds === null) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  await db
    .insert(showSpiceTable)
    .values({ userId: callerId, titleKey, mediaType, spicy })
    .onConflictDoUpdate({
      target: [
        showSpiceTable.userId,
        showSpiceTable.titleKey,
        showSpiceTable.mediaType,
      ],
      set: { spicy, updatedAt: new Date() },
    });

  const summary = await summarizeShow(memberIds, callerId, titleKey, mediaType);
  res.json(SetSpicyResponse.parse(summary));
});

router.delete("/spice", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ClearSpicyQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const titleKey = normalizeTitle(parsed.data.title);
  const { mediaType } = parsed.data;

  const memberIds = await resolveMemberIds(callerId, parsed.data.groupId);
  if (memberIds === null) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  await db
    .delete(showSpiceTable)
    .where(
      and(
        eq(showSpiceTable.userId, callerId),
        eq(showSpiceTable.titleKey, titleKey),
        eq(showSpiceTable.mediaType, mediaType),
      ),
    );

  const summary = await summarizeShow(memberIds, callerId, titleKey, mediaType);
  res.json(ClearSpicyResponse.parse(summary));
});

export default router;
