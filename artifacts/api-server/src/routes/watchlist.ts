import { Router, type IRouter } from "express";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { db, entriesTable, watchlistItemsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import {
  getGroupMemberIds,
  isMember,
  usersShareGroup,
} from "../lib/groups";
import { resolveDisplayName } from "../lib/displayName";
import {
  ListWatchlistQueryParams,
  ListWatchlistResponse,
  CreateWatchlistItemBody,
  DeleteWatchlistItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

router.get("/watchlist", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListWatchlistQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const targetUserId = parsed.data.userId ?? callerId;
  if (targetUserId !== callerId) {
    const allowed = await usersShareGroup(callerId, targetUserId);
    if (!allowed) {
      res.status(403).json({ error: "You don't share a group with this user" });
      return;
    }
  }

  if (parsed.data.groupId !== undefined) {
    const allowed = await isMember(parsed.data.groupId, callerId);
    if (!allowed) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }
  }

  const myItems = await db
    .select()
    .from(watchlistItemsTable)
    .where(eq(watchlistItemsTable.userId, targetUserId))
    .orderBy(desc(watchlistItemsTable.createdAt));

  if (myItems.length === 0) {
    res.json(ListWatchlistResponse.parse([]));
    return;
  }

  // "Also engaged by" is scoped to other members of the given group.
  // Membership was already verified above, so a groupId here is always valid.
  let otherMemberIds: string[] = [];
  if (parsed.data.groupId !== undefined) {
    otherMemberIds = (await getGroupMemberIds(parsed.data.groupId)).filter(
      (id) => id !== targetUserId,
    );
  }

  if (otherMemberIds.length === 0) {
    res.json(
      ListWatchlistResponse.parse(
        myItems.map((item) => ({
          id: item.id,
          title: item.title,
          mediaType: item.mediaType,
          createdAt: item.createdAt.toISOString(),
          alsoEngagedBy: [],
        })),
      ),
    );
    return;
  }

  const keys = Array.from(new Set(myItems.map((i) => i.titleKey)));

  const otherEntries = await db
    .select({
      userId: entriesTable.userId,
      addedBy: entriesTable.addedBy,
      titleKey: sql<string>`lower(trim(${entriesTable.title}))`,
      mediaType: entriesTable.mediaType,
    })
    .from(entriesTable)
    .where(
      and(
        inArray(entriesTable.userId, otherMemberIds),
        inArray(sql`lower(trim(${entriesTable.title}))`, keys),
      ),
    );

  const otherSaved = await db
    .select({
      userId: watchlistItemsTable.userId,
      addedBy: watchlistItemsTable.addedBy,
      titleKey: watchlistItemsTable.titleKey,
      mediaType: watchlistItemsTable.mediaType,
    })
    .from(watchlistItemsTable)
    .where(
      and(
        inArray(watchlistItemsTable.userId, otherMemberIds),
        inArray(watchlistItemsTable.titleKey, keys),
      ),
    );

  const matchKey = (titleKey: string, mediaType: string) =>
    `${titleKey}::${mediaType}`;

  const namesByShow = new Map<string, Map<string, string>>();
  for (const row of [...otherEntries, ...otherSaved]) {
    const key = matchKey(row.titleKey, row.mediaType);
    let names = namesByShow.get(key);
    if (!names) {
      names = new Map<string, string>();
      namesByShow.set(key, names);
    }
    if (!names.has(row.userId)) names.set(row.userId, row.addedBy);
  }

  const result = myItems.map((item) => {
    const names = namesByShow.get(matchKey(item.titleKey, item.mediaType));
    const alsoEngagedBy = names
      ? Array.from(names.values()).sort((a, b) => a.localeCompare(b))
      : [];
    return {
      id: item.id,
      title: item.title,
      mediaType: item.mediaType,
      createdAt: item.createdAt.toISOString(),
      alsoEngagedBy,
    };
  });

  res.json(ListWatchlistResponse.parse(result));
});

router.post("/watchlist", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreateWatchlistItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const addedBy = await resolveDisplayName(userId);

  const title = parsed.data.title.trim();
  const titleKey = normalizeTitle(title);

  const [item] = await db
    .insert(watchlistItemsTable)
    .values({
      userId,
      addedBy,
      title,
      titleKey,
      mediaType: parsed.data.mediaType,
    })
    .onConflictDoUpdate({
      target: [
        watchlistItemsTable.userId,
        watchlistItemsTable.titleKey,
        watchlistItemsTable.mediaType,
      ],
      set: { title },
    })
    .returning();

  res.status(201).json({
    id: item.id,
    title: item.title,
    mediaType: item.mediaType,
    createdAt: item.createdAt.toISOString(),
    alsoEngagedBy: [],
  });
});

router.delete(
  "/watchlist/:id",
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeleteWatchlistItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = req.userId!;

    const [deleted] = await db
      .delete(watchlistItemsTable)
      .where(
        and(
          eq(watchlistItemsTable.id, params.data.id),
          eq(watchlistItemsTable.userId, userId),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Watchlist item not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
