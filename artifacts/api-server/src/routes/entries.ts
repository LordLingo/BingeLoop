import { Router, type IRouter } from "express";
import { eq, desc, asc, and, or, isNull, inArray } from "drizzle-orm";
import { db, entriesTable } from "@workspace/db";
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
  GetStatsQueryParams,
  GetStatsResponse,
  ListCategoriesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const withAddedById = <T extends { userId: string }>(row: T) => ({
  ...row,
  addedById: row.userId,
});

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
  const averageRating =
    total === 0
      ? 0
      : Math.round((rows.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10;

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

  let orderBy;
  switch (sort) {
    case "oldest":
      orderBy = asc(entriesTable.createdAt);
      break;
    case "rating_high":
      orderBy = desc(entriesTable.rating);
      break;
    case "rating_low":
      orderBy = asc(entriesTable.rating);
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

  res.json(ListEntriesResponse.parse(rows.map(withAddedById)));
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
      rating: parsed.data.rating,
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

  res.status(201).json(GetEntryResponse.parse(withAddedById(entry)));
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
  if (entry.userId !== callerId) {
    // Visible if the entry belongs to a group you're an active member of, OR it
    // is a legacy un-grouped entry whose author currently shares an active group
    // with you (consistent with the group library surfacing such entries).
    const visible =
      entry.groupId != null
        ? await isMember(entry.groupId, callerId)
        : await usersShareGroup(callerId, entry.userId);
    if (!visible) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
  }

  res.json(GetEntryResponse.parse(withAddedById(entry)));
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
    res.json(UpdateEntryResponse.parse(withAddedById(existing)));
    return;
  }

  const [entry] = await db
    .update(entriesTable)
    .set(parsed.data)
    .where(eq(entriesTable.id, params.data.id))
    .returning();

  res.json(UpdateEntryResponse.parse(withAddedById(entry)));
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

export default router;
