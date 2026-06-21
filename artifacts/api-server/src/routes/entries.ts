import { Router, type IRouter } from "express";
import { eq, desc, asc, and, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, entriesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import {
  usersShareGroup,
  isMember,
  getGroupMemberIds,
  getSharedMemberIds,
} from "../lib/groups";
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
    if (queryUserId !== callerId) {
      const allowed = await usersShareGroup(callerId, queryUserId);
      if (!allowed) {
        res
          .status(403)
          .json({ error: "You don't share a group with this user" });
        return;
      }
    }
    memberFilter = eq(entriesTable.userId, queryUserId);
  } else if (groupId != null) {
    const allowed = await isMember(groupId, callerId);
    if (!allowed) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }
    const memberIds = await getGroupMemberIds(groupId);
    memberFilter = inArray(entriesTable.userId, memberIds);
  } else {
    const memberIds = await getSharedMemberIds(callerId);
    memberFilter = inArray(entriesTable.userId, memberIds);
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
  const { userId: queryUserId, groupId, category, mediaType, sort } = parsed.data;

  const callerId = req.userId!;

  let memberFilter;
  if (queryUserId) {
    if (queryUserId !== callerId) {
      const allowed = await usersShareGroup(callerId, queryUserId);
      if (!allowed) {
        res
          .status(403)
          .json({ error: "You don't share a group with this user" });
        return;
      }
    }
    memberFilter = eq(entriesTable.userId, queryUserId);
  } else if (groupId != null) {
    const allowed = await isMember(groupId, callerId);
    if (!allowed) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }
    const memberIds = await getGroupMemberIds(groupId);
    memberFilter = inArray(entriesTable.userId, memberIds);
  } else {
    const memberIds = await getSharedMemberIds(callerId);
    memberFilter = inArray(entriesTable.userId, memberIds);
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

  res.json(ListEntriesResponse.parse(rows));
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
  const user = await clerkClient.users.getUser(userId);
  const addedBy =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    "Unknown";

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
    })
    .returning();

  res.status(201).json(GetEntryResponse.parse(entry));
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
    const allowed = await usersShareGroup(callerId, entry.userId);
    if (!allowed) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
  }

  res.json(GetEntryResponse.parse(entry));
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

  if (Object.keys(parsed.data).length === 0) {
    res.json(UpdateEntryResponse.parse(existing));
    return;
  }

  const [entry] = await db
    .update(entriesTable)
    .set(parsed.data)
    .where(eq(entriesTable.id, params.data.id))
    .returning();

  res.json(UpdateEntryResponse.parse(entry));
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
