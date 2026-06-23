import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, showAudiencesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { getGroupMemberIds, getMembership } from "../lib/groups";
import {
  ListAudiencesQueryParams,
  ListAudiencesResponse,
  SetAudiencesBody,
  SetAudiencesResponse,
  ClearAudiencesQueryParams,
  ClearAudiencesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

const AUDIENCE_VALUES = ["girls", "guys", "couples", "solo"] as const;
type AudienceValue = (typeof AUDIENCE_VALUES)[number];

function isAudience(value: string): value is AudienceValue {
  return (AUDIENCE_VALUES as readonly string[]).includes(value);
}

// Keep only canonical audiences, de-duplicated and in canonical order.
function sanitize(values: string[]): AudienceValue[] {
  return AUDIENCE_VALUES.filter((v) => values.includes(v));
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

// Returns the member ids whose picks count toward a show's tallies for this
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

function emptyCounts() {
  return { girls: 0, guys: 0, couples: 0, solo: 0 };
}

async function summarizeShow(
  memberIds: string[],
  callerId: string,
  titleKey: string,
  mediaType: string,
) {
  const rows = await db
    .select({
      userId: showAudiencesTable.userId,
      audiences: showAudiencesTable.audiences,
    })
    .from(showAudiencesTable)
    .where(
      and(
        inArray(showAudiencesTable.userId, memberIds),
        eq(showAudiencesTable.titleKey, titleKey),
        eq(showAudiencesTable.mediaType, mediaType),
      ),
    );

  const counts = emptyCounts();
  let myAudiences: AudienceValue[] = [];
  for (const r of rows) {
    const picks = sanitize(r.audiences);
    for (const p of picks) counts[p] += 1;
    if (r.userId === callerId) myAudiences = picks;
  }

  return { titleKey, mediaType, ...counts, myAudiences };
}

router.get("/audiences", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListAudiencesQueryParams.safeParse(req.query);
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

  const rows = await db
    .select({
      userId: showAudiencesTable.userId,
      titleKey: showAudiencesTable.titleKey,
      mediaType: showAudiencesTable.mediaType,
      audiences: showAudiencesTable.audiences,
    })
    .from(showAudiencesTable)
    .where(inArray(showAudiencesTable.userId, memberIds));

  const key = (titleKey: string, mediaType: string) =>
    `${titleKey}::${mediaType}`;

  const byShow = new Map<
    string,
    {
      titleKey: string;
      mediaType: string;
      girls: number;
      guys: number;
      couples: number;
      solo: number;
      myAudiences: AudienceValue[];
    }
  >();

  for (const row of rows) {
    const k = key(row.titleKey, row.mediaType);
    let show = byShow.get(k);
    if (!show) {
      show = {
        titleKey: row.titleKey,
        mediaType: row.mediaType,
        ...emptyCounts(),
        myAudiences: [],
      };
      byShow.set(k, show);
    }
    const picks = sanitize(row.audiences);
    for (const p of picks) show[p] += 1;
    if (row.userId === callerId) show.myAudiences = picks;
  }

  res.json(ListAudiencesResponse.parse(Array.from(byShow.values())));
});

router.put("/audiences", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = SetAudiencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const titleKey = normalizeTitle(parsed.data.title);
  const { mediaType } = parsed.data;
  const audiences = sanitize(parsed.data.audiences);
  if (audiences.length === 0) {
    res.status(400).json({ error: "At least one audience is required" });
    return;
  }

  const memberIds = await resolveMemberIds(callerId, parsed.data.groupId);
  if (memberIds === null) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  await db
    .insert(showAudiencesTable)
    .values({ userId: callerId, titleKey, mediaType, audiences })
    .onConflictDoUpdate({
      target: [
        showAudiencesTable.userId,
        showAudiencesTable.titleKey,
        showAudiencesTable.mediaType,
      ],
      set: { audiences, updatedAt: new Date() },
    });

  const summary = await summarizeShow(memberIds, callerId, titleKey, mediaType);
  res.json(SetAudiencesResponse.parse(summary));
});

router.delete("/audiences", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ClearAudiencesQueryParams.safeParse(req.query);
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
    .delete(showAudiencesTable)
    .where(
      and(
        eq(showAudiencesTable.userId, callerId),
        eq(showAudiencesTable.titleKey, titleKey),
        eq(showAudiencesTable.mediaType, mediaType),
      ),
    );

  const summary = await summarizeShow(memberIds, callerId, titleKey, mediaType);
  res.json(ClearAudiencesResponse.parse(summary));
});

export default router;
