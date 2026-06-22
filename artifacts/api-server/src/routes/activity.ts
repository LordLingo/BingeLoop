import { Router, type IRouter } from "express";
import { eq, and, gt, lte, inArray, count, sql, asc, desc } from "drizzle-orm";
import {
  db,
  entriesTable,
  userActivityTable,
  watchlistItemsTable,
  showCommentsTable,
  showApprovalsTable,
  showSpiceTable,
  groupMembersTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { getGroupMemberIds, getMembership } from "../lib/groups";
import { resolveDisplayName } from "../lib/displayName";
import {
  CheckInQueryParams,
  CheckInResponse,
  ListActivityFeedQueryParams,
  ListActivityFeedResponse,
  GetWeeklyDigestQueryParams,
  GetWeeklyDigestResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

// Member ids whose activity the caller may see: just the caller without a
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

type FeedItem = {
  id: string;
  type: "rating" | "watchlist" | "comment" | "approval" | "spice";
  actorName: string;
  title: string;
  mediaType: string;
  createdAt: Date;
  entryId: number | null;
  rating: number | null;
  approval: string | null;
  spicy: string | null;
};

const showKey = (titleKey: string, mediaType: string): string =>
  `${titleKey}::${mediaType}`;

router.post(
  "/activity/check-in",
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = CheckInQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = req.userId!;

    const [existing] = await db
      .select()
      .from(userActivityTable)
      .where(eq(userActivityTable.userId, userId));

    const since = existing?.lastSeenAt ?? null;
    const now = new Date();

    // Other members of the chosen group whose new entries we count.
    let otherMemberIds: string[] = [];
    if (parsed.data.groupId !== undefined) {
      const membership = await getMembership(parsed.data.groupId, userId);
      if (membership) {
        otherMemberIds = (
          await getGroupMemberIds(parsed.data.groupId)
        ).filter((id) => id !== userId);
      }
    }

    let newCount = 0;
    if (since && otherMemberIds.length > 0) {
      const [row] = await db
        .select({ value: count() })
        .from(entriesTable)
        .where(
          and(
            gt(entriesTable.createdAt, since),
            lte(entriesTable.createdAt, now),
            inArray(entriesTable.userId, otherMemberIds),
          ),
        );
      newCount = row?.value ?? 0;
    }

    await db
      .insert(userActivityTable)
      .values({ userId, lastSeenAt: now })
      .onConflictDoUpdate({
        target: userActivityTable.userId,
        set: {
          lastSeenAt: sql`GREATEST(${userActivityTable.lastSeenAt}, excluded.last_seen_at)`,
        },
      });

    res.json(
      CheckInResponse.parse({
        newCount,
        since: since ? since.toISOString() : null,
      }),
    );
  },
);

router.get("/activity/feed", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListActivityFeedQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const { groupId } = parsed.data;
  const limit = parsed.data.limit ?? 50;

  const memberIds = await resolveMemberIds(callerId, groupId);
  if (memberIds === null) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }
  if (memberIds.length === 0) {
    res.json([]);
    return;
  }

  // Display names for approval/spice actors (those rows store only userId).
  // In group mode every actor is a current member, so the membership rows
  // cover them; without a group the only actor is the caller.
  const nameByUser = new Map<string, string>();
  if (groupId !== undefined) {
    const members = await db
      .select({
        userId: groupMembersTable.userId,
        displayName: groupMembersTable.displayName,
      })
      .from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));
    for (const m of members) nameByUser.set(m.userId, m.displayName);
  }
  const actorName = async (userId: string): Promise<string> => {
    const known = nameByUser.get(userId);
    if (known) return known;
    const resolved = await resolveDisplayName(userId);
    nameByUser.set(userId, resolved);
    return resolved;
  };

  // Fetch source rows for the resolved members. Entries/watchlist are fetched
  // in full because they also supply the display title and a linkable entry id
  // for shows referenced by comments/approvals/spice (which store only the
  // normalized titleKey). The poll/comment tables are capped at `limit`.
  const [entryRows, watchRows, commentRows, approvalRows, spiceRows] =
    await Promise.all([
      db
        .select({
          id: entriesTable.id,
          title: entriesTable.title,
          mediaType: entriesTable.mediaType,
          rating: entriesTable.rating,
          addedBy: entriesTable.addedBy,
          createdAt: entriesTable.createdAt,
        })
        .from(entriesTable)
        .where(inArray(entriesTable.userId, memberIds))
        .orderBy(asc(entriesTable.createdAt)),
      db
        .select({
          id: watchlistItemsTable.id,
          title: watchlistItemsTable.title,
          mediaType: watchlistItemsTable.mediaType,
          addedBy: watchlistItemsTable.addedBy,
          createdAt: watchlistItemsTable.createdAt,
        })
        .from(watchlistItemsTable)
        .where(inArray(watchlistItemsTable.userId, memberIds)),
      db
        .select({
          id: showCommentsTable.id,
          authorName: showCommentsTable.authorName,
          titleKey: showCommentsTable.titleKey,
          mediaType: showCommentsTable.mediaType,
          createdAt: showCommentsTable.createdAt,
        })
        .from(showCommentsTable)
        .where(inArray(showCommentsTable.userId, memberIds))
        .orderBy(desc(showCommentsTable.createdAt))
        .limit(limit),
      db
        .select({
          id: showApprovalsTable.id,
          userId: showApprovalsTable.userId,
          titleKey: showApprovalsTable.titleKey,
          mediaType: showApprovalsTable.mediaType,
          approval: showApprovalsTable.approval,
          updatedAt: showApprovalsTable.updatedAt,
        })
        .from(showApprovalsTable)
        .where(inArray(showApprovalsTable.userId, memberIds))
        .orderBy(desc(showApprovalsTable.updatedAt))
        .limit(limit),
      db
        .select({
          id: showSpiceTable.id,
          userId: showSpiceTable.userId,
          titleKey: showSpiceTable.titleKey,
          mediaType: showSpiceTable.mediaType,
          spicy: showSpiceTable.spicy,
          updatedAt: showSpiceTable.updatedAt,
        })
        .from(showSpiceTable)
        .where(inArray(showSpiceTable.userId, memberIds))
        .orderBy(desc(showSpiceTable.updatedAt))
        .limit(limit),
    ]);

  // Map each show to a display title and an openable entry id. Entries are in
  // ascending createdAt order, so the last write wins (newest title casing and
  // newest entry id); watchlist only fills titles for shows with no entry.
  const titleByKey = new Map<string, string>();
  const entryIdByKey = new Map<string, number>();
  for (const e of entryRows) {
    const key = showKey(normalizeTitle(e.title), e.mediaType);
    titleByKey.set(key, e.title);
    entryIdByKey.set(key, e.id);
  }
  for (const w of watchRows) {
    const key = showKey(normalizeTitle(w.title), w.mediaType);
    if (!titleByKey.has(key)) titleByKey.set(key, w.title);
  }

  const items: FeedItem[] = [];

  for (const e of entryRows) {
    items.push({
      id: `rating:${e.id}`,
      type: "rating",
      actorName: e.addedBy,
      title: e.title,
      mediaType: e.mediaType,
      createdAt: e.createdAt,
      entryId: e.id,
      rating: e.rating,
      approval: null,
      spicy: null,
    });
  }
  for (const w of watchRows) {
    const key = showKey(normalizeTitle(w.title), w.mediaType);
    items.push({
      id: `watchlist:${w.id}`,
      type: "watchlist",
      actorName: w.addedBy,
      title: w.title,
      mediaType: w.mediaType,
      createdAt: w.createdAt,
      entryId: entryIdByKey.get(key) ?? null,
      rating: null,
      approval: null,
      spicy: null,
    });
  }
  for (const c of commentRows) {
    const key = showKey(c.titleKey, c.mediaType);
    items.push({
      id: `comment:${c.id}`,
      type: "comment",
      actorName: c.authorName,
      title: titleByKey.get(key) ?? c.titleKey,
      mediaType: c.mediaType,
      createdAt: c.createdAt,
      entryId: entryIdByKey.get(key) ?? null,
      rating: null,
      approval: null,
      spicy: null,
    });
  }
  for (const a of approvalRows) {
    const key = showKey(a.titleKey, a.mediaType);
    items.push({
      id: `approval:${a.id}`,
      type: "approval",
      actorName: await actorName(a.userId),
      title: titleByKey.get(key) ?? a.titleKey,
      mediaType: a.mediaType,
      createdAt: a.updatedAt,
      entryId: entryIdByKey.get(key) ?? null,
      rating: null,
      approval: a.approval,
      spicy: null,
    });
  }
  for (const s of spiceRows) {
    const key = showKey(s.titleKey, s.mediaType);
    items.push({
      id: `spice:${s.id}`,
      type: "spice",
      actorName: await actorName(s.userId),
      title: titleByKey.get(key) ?? s.titleKey,
      mediaType: s.mediaType,
      createdAt: s.updatedAt,
      entryId: entryIdByKey.get(key) ?? null,
      rating: null,
      approval: null,
      spicy: s.spicy,
    });
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json(ListActivityFeedResponse.parse(items.slice(0, limit)));
});

router.get(
  "/activity/digest",
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = GetWeeklyDigestQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const callerId = req.userId!;
    const { groupId } = parsed.data;

    const memberIds = await resolveMemberIds(callerId, groupId);
    if (memberIds === null) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (memberIds.length === 0) {
      res.json(
        GetWeeklyDigestResponse.parse({
          since: since.toISOString(),
          newRatings: 0,
          newComments: 0,
          newSaves: 0,
          topShow: null,
          mostActive: null,
        }),
      );
      return;
    }

    // Pull the week's source rows for the resolved members. Names are the
    // snapshots stored on each row (addedBy / authorName), so no display-name
    // resolution is needed for the "most active" tally.
    const [entryRows, commentRows, watchRows, topRows] = await Promise.all([
      db
        .select({ addedBy: entriesTable.addedBy })
        .from(entriesTable)
        .where(
          and(
            inArray(entriesTable.userId, memberIds),
            gt(entriesTable.createdAt, since),
          ),
        ),
      db
        .select({ authorName: showCommentsTable.authorName })
        .from(showCommentsTable)
        .where(
          and(
            inArray(showCommentsTable.userId, memberIds),
            gt(showCommentsTable.createdAt, since),
          ),
        ),
      db
        .select({ addedBy: watchlistItemsTable.addedBy })
        .from(watchlistItemsTable)
        .where(
          and(
            inArray(watchlistItemsTable.userId, memberIds),
            gt(watchlistItemsTable.createdAt, since),
          ),
        ),
      db
        .select({
          id: entriesTable.id,
          title: entriesTable.title,
          mediaType: entriesTable.mediaType,
          rating: entriesTable.rating,
          addedBy: entriesTable.addedBy,
        })
        .from(entriesTable)
        .where(
          and(
            inArray(entriesTable.userId, memberIds),
            gt(entriesTable.createdAt, since),
          ),
        )
        .orderBy(desc(entriesTable.rating), desc(entriesTable.createdAt))
        .limit(1),
    ]);

    // Most active member by total actions (ratings + comments + saves).
    const actionsByName = new Map<string, number>();
    const bump = (name: string) =>
      actionsByName.set(name, (actionsByName.get(name) ?? 0) + 1);
    for (const r of entryRows) bump(r.addedBy);
    for (const c of commentRows) bump(c.authorName);
    for (const w of watchRows) bump(w.addedBy);

    let mostActive: { name: string; count: number } | null = null;
    for (const [name, c] of actionsByName) {
      if (!mostActive || c > mostActive.count) mostActive = { name, count: c };
    }

    const top = topRows[0];

    res.json(
      GetWeeklyDigestResponse.parse({
        since: since.toISOString(),
        newRatings: entryRows.length,
        newComments: commentRows.length,
        newSaves: watchRows.length,
        topShow: top
          ? {
              title: top.title,
              mediaType: top.mediaType,
              rating: top.rating,
              addedBy: top.addedBy,
              entryId: top.id,
            }
          : null,
        mostActive,
      }),
    );
  },
);

export default router;
