import { Router, type IRouter } from "express";
import { eq, desc, asc, and, or, isNull, inArray, sql } from "drizzle-orm";
import { db, entriesTable, entryRatingsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import {
  sharedActiveGroupIds,
  isMember,
  usersShareGroup,
  getActiveGroupMemberIds,
} from "../lib/groups";
import { resolveDisplayName } from "../lib/displayName";
import {
  ListEntriesQueryParams,
  ListEntriesResponse,
  CreateEntryBody,
  GetEntryParams,
  GetEntryResponse,
  UpdateEntryParams,
  UpdateEntryBody,
  UpdateEntryResponse,
  DeleteEntryParams,
  SetEntryRatingParams,
  SetEntryRatingBody,
  SetEntryRatingResponse,
  ClearEntryRatingParams,
  ClearEntryRatingResponse,
  GetStatsQueryParams,
  GetStatsResponse,
  ListCategoriesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type EntryRow = typeof entriesTable.$inferSelect;

// Decorate raw entry rows with the per-member rating aggregate the API exposes:
// averageRating (mean across all raters, null if none), ratingCount, and the
// caller's own myRating. Ratings live in entryRatingsTable, one row per
// (entry, member); the legacy entries.rating column is no longer read.
async function enrichEntries(rows: EntryRow[], callerId: string) {
  const ids = rows.map((r) => r.id);
  const agg = new Map<number, { avg: number; count: number }>();
  const mine = new Map<number, number>();

  if (ids.length > 0) {
    const aggRows = await db
      .select({
        entryId: entryRatingsTable.entryId,
        avg: sql<string>`avg(${entryRatingsTable.rating})`,
        cnt: sql<string>`count(*)`,
      })
      .from(entryRatingsTable)
      .where(inArray(entryRatingsTable.entryId, ids))
      .groupBy(entryRatingsTable.entryId);
    for (const a of aggRows) {
      agg.set(a.entryId, { avg: Number(a.avg), count: Number(a.cnt) });
    }

    const mineRows = await db
      .select({
        entryId: entryRatingsTable.entryId,
        rating: entryRatingsTable.rating,
      })
      .from(entryRatingsTable)
      .where(
        and(
          inArray(entryRatingsTable.entryId, ids),
          eq(entryRatingsTable.userId, callerId),
        ),
      );
    for (const m of mineRows) mine.set(m.entryId, m.rating);
  }

  return rows.map((row) => {
    const a = agg.get(row.id);
    return {
      ...row,
      addedById: row.userId,
      averageRating:
        a && a.count > 0 ? Math.round(a.avg * 10) / 10 : null,
      ratingCount: a ? a.count : 0,
      myRating: mine.get(row.id) ?? null,
    };
  });
}

// Whether the caller may see (and therefore rate) this entry: their own, a
// group entry they're an active member of, or a legacy un-grouped entry whose
// author currently shares an active group with them.
async function canSeeEntry(entry: EntryRow, callerId: string): Promise<boolean> {
  if (entry.userId === callerId) return true;
  return entry.groupId != null
    ? await isMember(entry.groupId, callerId)
    : await usersShareGroup(callerId, entry.userId);
}

// Entries visible inside a group's shared library: anything explicitly assigned
// to the group, PLUS legacy un-grouped (group_id IS NULL) entries logged by the
// group's current active members — so shows from before groups existed reappear
// for everyone in the groups their author belongs to.
async function groupScopedFilter(groupId: number) {
  const memberIds = await getActiveGroupMemberIds(groupId);
  const assigned = eq(entriesTable.groupId, groupId);
  if (memberIds.length === 0) return assigned;
  return or(
    assigned,
    and(isNull(entriesTable.groupId), inArray(entriesTable.userId, memberIds)),
  );
}

router.use(requireAuth);

const CATEGORIES = [
  "Drama",
  "Comedy",
  "Thriller",
  "Action",
  "Horror",
  "Sci-Fi",
  "Fantasy",
  "Romance",
  "Documentary",
  "Animation",
  "Crime",
  "Mystery",
];

router.get("/categories", async (_req, res): Promise<void> => {
  res.json(ListCategoriesResponse.parse(CATEGORIES));
});

router.get("/stats", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = GetStatsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const { userId: queryUserId, groupId } = parsed.data;

  let memberFilter;
  if (queryUserId) {
    if (queryUserId === callerId) {
      memberFilter = eq(entriesTable.userId, callerId);
    } else {
      const sharedIds = await sharedActiveGroupIds(callerId, queryUserId);
      if (sharedIds.length === 0) {
        res
          .status(403)
          .json({ error: "You don't share a group with this user" });
        return;
      }
      // Only this member's entries from groups you currently share with them.
      memberFilter = and(
        eq(entriesTable.userId, queryUserId),
        inArray(entriesTable.groupId, sharedIds),
      );
    }
  } else if (groupId != null) {
    const allowed = await isMember(groupId, callerId);
    if (!allowed) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }
    memberFilter = await groupScopedFilter(groupId);
  } else {
    memberFilter = eq(entriesTable.userId, callerId);
  }

  const rows = await db.select().from(entriesTable).where(memberFilter);

  const total = rows.length;
  const movieCount = rows.filter((r) => r.mediaType === "movie").length;
  const tvCount = rows.filter((r) => r.mediaType === "tv").length;

  // Average across actual ratings only (unrated shows are ignored). For a member
  // scope (own or another member) average that member's personal ratings; for a
  // group scope average every member's ratings on the in-scope shows.
  const ratingUserId = queryUserId ?? (groupId != null ? null : callerId);
  const entryIds = rows.map((r) => r.id);
  let averageRating = 0;
  if (entryIds.length > 0) {
    const conds = [inArray(entryRatingsTable.entryId, entryIds)];
    if (ratingUserId != null) {
      conds.push(eq(entryRatingsTable.userId, ratingUserId));
    }
    const [a] = await db
      .select({
        avg: sql<string>`avg(${entryRatingsTable.rating})`,
        cnt: sql<string>`count(*)`,
      })
      .from(entryRatingsTable)
      .where(and(...conds));
    averageRating =
      a && Number(a.cnt) > 0 ? Math.round(Number(a.avg) * 10) / 10 : 0;
  }

  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  }
  const byCategory = Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  res.json(
    GetStatsResponse.parse({
      total,
      movieCount,
      tvCount,
      averageRating,
      byCategory,
    }),
  );
});

router.get("/entries", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListEntriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const {
    userId: queryUserId,
    groupId,
    unassigned,
    category,
    mediaType,
    sort,
  } = parsed.data;

  const callerId = req.userId!;

  let memberFilter;
  if (unassigned) {
    memberFilter = and(
      eq(entriesTable.userId, callerId),
      isNull(entriesTable.groupId),
    );
  } else if (queryUserId) {
    if (queryUserId === callerId) {
      memberFilter = eq(entriesTable.userId, callerId);
    } else {
      const sharedIds = await sharedActiveGroupIds(callerId, queryUserId);
      if (sharedIds.length === 0) {
        res
          .status(403)
          .json({ error: "You don't share a group with this user" });
        return;
      }
      // Only this member's entries from groups you currently share with them.
      memberFilter = and(
        eq(entriesTable.userId, queryUserId),
        inArray(entriesTable.groupId, sharedIds),
      );
    }
  } else if (groupId != null) {
    const allowed = await isMember(groupId, callerId);
    if (!allowed) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }
    memberFilter = await groupScopedFilter(groupId);
  } else {
    memberFilter = eq(entriesTable.userId, callerId);
  }

  const conditions = [memberFilter];
  if (category) conditions.push(eq(entriesTable.category, category));
  if (mediaType) conditions.push(eq(entriesTable.mediaType, mediaType));

  // Rating sorts can't be done in SQL anymore (the value is an aggregate of
  // entryRatingsTable), so fetch newest-first as a stable base order and re-sort
  // in memory after enrichment, keeping unrated shows last for both directions.
  const isRatingSort = sort === "rating_high" || sort === "rating_low";
  let orderBy;
  switch (sort) {
    case "oldest":
      orderBy = asc(entriesTable.createdAt);
      break;
    case "title":
      orderBy = asc(entriesTable.title);
      break;
    case "newest":
    default:
      orderBy = desc(entriesTable.createdAt);
      break;
  }

  const rows = await db
    .select()
    .from(entriesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orderBy);

  let enriched = await enrichEntries(rows, callerId);

  if (isRatingSort) {
    const dir = sort === "rating_high" ? -1 : 1;
    enriched = [...enriched].sort((a, b) => {
      const aHas = a.averageRating != null;
      const bHas = b.averageRating != null;
      if (aHas && bHas) return (a.averageRating! - b.averageRating!) * dir;
      if (aHas) return -1;
      if (bHas) return 1;
      return 0;
    });
  }

  res.json(ListEntriesResponse.parse(enriched));
});

router.post("/entries", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreateEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!CATEGORIES.includes(parsed.data.category)) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  const userId = req.userId!;

  const groupId = parsed.data.groupId ?? null;
  if (groupId != null) {
    const allowed = await isMember(groupId, userId);
    if (!allowed) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }
  }

  const addedBy = await resolveDisplayName(userId);

  const [entry] = await db
    .insert(entriesTable)
    .values({
      title: parsed.data.title,
      mediaType: parsed.data.mediaType,
      category: parsed.data.category,
      comment: parsed.data.comment ?? null,
      userId,
      addedBy,
      groupId,
      tmdbId: parsed.data.tmdbId ?? null,
      posterPath: parsed.data.posterPath ?? null,
      streamingProvider: parsed.data.streamingProvider ?? null,
      streamingLogo: parsed.data.streamingLogo ?? null,
      network: parsed.data.network ?? null,
    })
    .returning();

  // Optional initial personal rating for the member adding the show.
  if (parsed.data.rating != null) {
    await db.insert(entryRatingsTable).values({
      entryId: entry.id,
      userId,
      rating: parsed.data.rating,
    });
  }

  const [enriched] = await enrichEntries([entry], userId);
  res.status(201).json(GetEntryResponse.parse(enriched));
});

router.get("/entries/:id", async (req: AuthedRequest, res): Promise<void> => {
  const params = GetEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.id, params.data.id));

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const callerId = req.userId!;
  if (!(await canSeeEntry(entry, callerId))) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const [enriched] = await enrichEntries([entry], callerId);
  res.json(GetEntryResponse.parse(enriched));
});

router.patch("/entries/:id", async (req: AuthedRequest, res): Promise<void> => {
  const params = UpdateEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (
    parsed.data.category !== undefined &&
    !CATEGORIES.includes(parsed.data.category)
  ) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  const [existing] = await db
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  if (existing.userId !== req.userId!) {
    res.status(403).json({ error: "You can only edit your own entries" });
    return;
  }

  if (parsed.data.groupId != null) {
    const allowed = await isMember(parsed.data.groupId, req.userId!);
    if (!allowed) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }
  }

  if (Object.keys(parsed.data).length === 0) {
    const [enriched] = await enrichEntries([existing], req.userId!);
    res.json(UpdateEntryResponse.parse(enriched));
    return;
  }

  const [entry] = await db
    .update(entriesTable)
    .set(parsed.data)
    .where(eq(entriesTable.id, params.data.id))
    .returning();

  const [enriched] = await enrichEntries([entry], req.userId!);
  res.json(UpdateEntryResponse.parse(enriched));
});

router.delete(
  "/entries/:id",
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeleteEntryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(entriesTable)
      .where(
        and(
          eq(entriesTable.id, params.data.id),
          eq(entriesTable.userId, req.userId!),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    res.sendStatus(204);
  },
);

// Set or change the caller's own rating for a show. Any member who can see the
// show may rate it. The membership/visibility check runs BEFORE any write so a
// 403 leaves no side effects.
router.put(
  "/entries/:id/rating",
  async (req: AuthedRequest, res): Promise<void> => {
    const params = SetEntryRatingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SetEntryRatingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [entry] = await db
      .select()
      .from(entriesTable)
      .where(eq(entriesTable.id, params.data.id));
    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    const callerId = req.userId!;
    if (!(await canSeeEntry(entry, callerId))) {
      res.status(403).json({ error: "You can't rate this show" });
      return;
    }

    await db
      .insert(entryRatingsTable)
      .values({ entryId: entry.id, userId: callerId, rating: parsed.data.rating })
      .onConflictDoUpdate({
        target: [entryRatingsTable.entryId, entryRatingsTable.userId],
        set: { rating: parsed.data.rating, updatedAt: new Date() },
      });

    const [enriched] = await enrichEntries([entry], callerId);
    res.json(SetEntryRatingResponse.parse(enriched));
  },
);

// Clear the caller's own rating for a show.
router.delete(
  "/entries/:id/rating",
  async (req: AuthedRequest, res): Promise<void> => {
    const params = ClearEntryRatingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [entry] = await db
      .select()
      .from(entriesTable)
      .where(eq(entriesTable.id, params.data.id));
    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    const callerId = req.userId!;
    if (!(await canSeeEntry(entry, callerId))) {
      res.status(403).json({ error: "You can't rate this show" });
      return;
    }

    await db
      .delete(entryRatingsTable)
      .where(
        and(
          eq(entryRatingsTable.entryId, entry.id),
          eq(entryRatingsTable.userId, callerId),
        ),
      );

    const [enriched] = await enrichEntries([entry], callerId);
    res.json(ClearEntryRatingResponse.parse(enriched));
  },
);

export default router;
