import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, desc, asc, and } from "drizzle-orm";
import { getAuth, clerkClient } from "@clerk/express";
import { db, entriesTable } from "@workspace/db";
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
  GetStatsResponse,
  ListCategoriesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId?: string;
}

const requireAuth = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
};

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

router.get("/stats", async (_req, res): Promise<void> => {
  const rows = await db.select().from(entriesTable);

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

router.get("/entries", async (req, res): Promise<void> => {
  const parsed = ListEntriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category, mediaType, sort } = parsed.data;

  const conditions = [];
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

router.get("/entries/:id", async (req, res): Promise<void> => {
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

  res.json(GetEntryResponse.parse(entry));
});

router.patch("/entries/:id", async (req, res): Promise<void> => {
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

  if (Object.keys(parsed.data).length === 0) {
    const [existing] = await db
      .select()
      .from(entriesTable)
      .where(eq(entriesTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(UpdateEntryResponse.parse(existing));
    return;
  }

  const [entry] = await db
    .update(entriesTable)
    .set(parsed.data)
    .where(eq(entriesTable.id, params.data.id))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.json(UpdateEntryResponse.parse(entry));
});

router.delete("/entries/:id", async (req, res): Promise<void> => {
  const params = DeleteEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db
    .delete(entriesTable)
    .where(eq(entriesTable.id, params.data.id))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
