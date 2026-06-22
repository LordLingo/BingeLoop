import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, reactionsTable, entriesTable, showCommentsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { getGroupMemberIds, getMembership } from "../lib/groups";
import {
  ListReactionsQueryParams,
  ListReactionsResponse,
  ToggleReactionBody,
  ToggleReactionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

// Canonical display order for the supported emoji set. Summaries list only the
// emojis that have at least one reaction, but always in this order.
const EMOJI_ORDER = ["👍", "❤️", "😂", "😮", "🔥"] as const;

type ReactionRow = { userId: string; emoji: string };

// Member ids whose reactions count for this caller: just the caller without a
// group, all members of the group when a member, or null (→ 403) when the
// caller passed a group they don't belong to. Mirrors the contract used by
// /entries, /stats, /approvals, /spice, /comments.
async function resolveMemberIds(
  callerId: string,
  groupId: number | undefined,
): Promise<string[] | null> {
  if (groupId === undefined) return [callerId];
  const membership = await getMembership(groupId, callerId);
  if (!membership) return null;
  return getGroupMemberIds(groupId);
}

function summarize(
  targetType: "entry" | "comment",
  targetId: number,
  rows: ReactionRow[],
  callerId: string,
) {
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const r of rows) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    if (r.userId === callerId) mine.add(r.emoji);
  }
  const emojis = EMOJI_ORDER.filter((e) => counts.has(e)).map((e) => ({
    emoji: e,
    count: counts.get(e)!,
  }));
  return {
    targetType,
    targetId,
    emojis,
    mine: EMOJI_ORDER.filter((e) => mine.has(e)),
  };
}

router.get("/reactions", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListReactionsQueryParams.safeParse(req.query);
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
      userId: reactionsTable.userId,
      targetType: reactionsTable.targetType,
      targetId: reactionsTable.targetId,
      emoji: reactionsTable.emoji,
    })
    .from(reactionsTable)
    .where(inArray(reactionsTable.userId, memberIds));

  const byTarget = new Map<string, ReactionRow[]>();
  const meta = new Map<string, { targetType: "entry" | "comment"; targetId: number }>();
  const entryIds = new Set<number>();
  const commentIds = new Set<number>();
  for (const r of rows) {
    if (r.targetType !== "entry" && r.targetType !== "comment") continue;
    const key = `${r.targetType}:${r.targetId}`;
    const arr = byTarget.get(key) ?? [];
    arr.push({ userId: r.userId, emoji: r.emoji });
    byTarget.set(key, arr);
    meta.set(key, { targetType: r.targetType, targetId: r.targetId });
    if (r.targetType === "entry") entryIds.add(r.targetId);
    else commentIds.add(r.targetId);
  }

  // A member may belong to MULTIPLE groups, so filtering reactions by reacting
  // user alone is not enough — a reaction that member left on content outside
  // THIS group must not surface here. Keep only targets the resolved member set
  // actually authored (the same visibility rule the POST path enforces).
  const visible = new Set<string>();
  if (entryIds.size > 0) {
    const owned = await db
      .select({ id: entriesTable.id })
      .from(entriesTable)
      .where(
        and(
          inArray(entriesTable.id, Array.from(entryIds)),
          inArray(entriesTable.userId, memberIds),
        ),
      );
    for (const e of owned) visible.add(`entry:${e.id}`);
  }
  if (commentIds.size > 0) {
    const owned = await db
      .select({ id: showCommentsTable.id })
      .from(showCommentsTable)
      .where(
        and(
          inArray(showCommentsTable.id, Array.from(commentIds)),
          inArray(showCommentsTable.userId, memberIds),
        ),
      );
    for (const c of owned) visible.add(`comment:${c.id}`);
  }

  const summaries = Array.from(meta.entries())
    .filter(([key]) => visible.has(key))
    .map(([key, m]) =>
      summarize(m.targetType, m.targetId, byTarget.get(key) ?? [], callerId),
    );

  res.json(ListReactionsResponse.parse(summaries));
});

router.post("/reactions", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ToggleReactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const { targetType, targetId, emoji } = parsed.data;

  // Membership/authorization must be confirmed BEFORE any mutation, so a 403
  // leaves no side effects.
  const memberIds = await resolveMemberIds(callerId, parsed.data.groupId);
  if (memberIds === null) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  // The target must exist and be visible to the resolved member set (authored
  // by a member), so reactions stay scoped to content the caller can see.
  let targetOwner: string | undefined;
  if (targetType === "entry") {
    const [row] = await db
      .select({ userId: entriesTable.userId })
      .from(entriesTable)
      .where(eq(entriesTable.id, targetId));
    targetOwner = row?.userId;
  } else {
    const [row] = await db
      .select({ userId: showCommentsTable.userId })
      .from(showCommentsTable)
      .where(eq(showCommentsTable.id, targetId));
    targetOwner = row?.userId;
  }
  if (targetOwner === undefined || !memberIds.includes(targetOwner)) {
    res.status(400).json({ error: "Invalid target" });
    return;
  }

  // Toggle: remove the caller's reaction if it already exists, else add it.
  const [existing] = await db
    .select({ id: reactionsTable.id })
    .from(reactionsTable)
    .where(
      and(
        eq(reactionsTable.userId, callerId),
        eq(reactionsTable.targetType, targetType),
        eq(reactionsTable.targetId, targetId),
        eq(reactionsTable.emoji, emoji),
      ),
    );

  if (existing) {
    await db.delete(reactionsTable).where(eq(reactionsTable.id, existing.id));
  } else {
    await db
      .insert(reactionsTable)
      .values({ userId: callerId, targetType, targetId, emoji })
      .onConflictDoNothing();
  }

  const rows = await db
    .select({
      userId: reactionsTable.userId,
      emoji: reactionsTable.emoji,
    })
    .from(reactionsTable)
    .where(
      and(
        inArray(reactionsTable.userId, memberIds),
        eq(reactionsTable.targetType, targetType),
        eq(reactionsTable.targetId, targetId),
      ),
    );

  res.json(
    ToggleReactionResponse.parse(
      summarize(targetType, targetId, rows, callerId),
    ),
  );
});

export default router;
