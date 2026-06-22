import { Router, type IRouter } from "express";
import { eq, and, inArray, desc, asc, sql } from "drizzle-orm";
import { db, listsTable, listItemsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { getGroupMemberIds, getMembership, usersShareGroup } from "../lib/groups";
import { resolveDisplayName } from "../lib/displayName";
import {
  ListListsQueryParams,
  ListListsResponse,
  ListListsResponseItem,
  CreateListBody,
  GetListParams,
  GetListResponse,
  UpdateListParams,
  UpdateListBody,
  UpdateListResponse,
  DeleteListParams,
  AddListItemParams,
  AddListItemBody,
  DeleteListItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

// Returns the member ids whose lists are visible to this caller: just the
// caller when no group is given, or all members of the group. Returns null when
// the caller passed a group they don't belong to, so the route can respond with
// a 403 (consistent with /entries, /comments, etc.).
async function resolveMemberIds(
  callerId: string,
  groupId: number | undefined,
): Promise<string[] | null> {
  if (groupId === undefined) return [callerId];
  const membership = await getMembership(groupId, callerId);
  if (!membership) return null;
  return getGroupMemberIds(groupId);
}

router.get("/lists", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListListsQueryParams.safeParse(req.query);
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

  const lists = await db
    .select()
    .from(listsTable)
    .where(inArray(listsTable.ownerId, memberIds))
    .orderBy(desc(listsTable.createdAt));

  let countByList = new Map<number, number>();
  if (lists.length > 0) {
    const counts = await db
      .select({
        listId: listItemsTable.listId,
        count: sql<number>`count(*)::int`,
      })
      .from(listItemsTable)
      .where(
        inArray(
          listItemsTable.listId,
          lists.map((l) => l.id),
        ),
      )
      .groupBy(listItemsTable.listId);
    countByList = new Map(counts.map((c) => [c.listId, c.count]));
  }

  res.json(
    ListListsResponse.parse(
      lists.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        ownerId: l.ownerId,
        ownerName: l.ownerName,
        itemCount: countByList.get(l.id) ?? 0,
        createdAt: l.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/lists", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreateListBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "List name cannot be empty" });
    return;
  }
  const ownerName = await resolveDisplayName(callerId);
  const description = parsed.data.description?.trim() || null;

  const [created] = await db
    .insert(listsTable)
    .values({ ownerId: callerId, ownerName, name, description })
    .returning();

  res.status(201).json(
    ListListsResponseItem.parse({
      id: created.id,
      name: created.name,
      description: created.description,
      ownerId: created.ownerId,
      ownerName: created.ownerName,
      itemCount: 0,
      createdAt: created.createdAt.toISOString(),
    }),
  );
});

router.get("/lists/:id", async (req: AuthedRequest, res): Promise<void> => {
  const params = GetListParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const callerId = req.userId!;
  const [list] = await db
    .select()
    .from(listsTable)
    .where(eq(listsTable.id, params.data.id));

  if (!list) {
    res.status(404).json({ error: "List not found" });
    return;
  }

  // Browsable by anyone who shares a group with the owner (or the owner).
  const allowed = await usersShareGroup(callerId, list.ownerId);
  if (!allowed) {
    res.status(403).json({ error: "You don't share a group with this user" });
    return;
  }

  const items = await db
    .select({
      id: listItemsTable.id,
      title: listItemsTable.title,
      mediaType: listItemsTable.mediaType,
    })
    .from(listItemsTable)
    .where(eq(listItemsTable.listId, list.id))
    .orderBy(asc(listItemsTable.id));

  res.json(
    GetListResponse.parse({
      id: list.id,
      name: list.name,
      description: list.description,
      ownerId: list.ownerId,
      ownerName: list.ownerName,
      createdAt: list.createdAt.toISOString(),
      items,
    }),
  );
});

router.patch("/lists/:id", async (req: AuthedRequest, res): Promise<void> => {
  const params = UpdateListParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateListBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const [list] = await db
    .select()
    .from(listsTable)
    .where(eq(listsTable.id, params.data.id));

  if (!list) {
    res.status(404).json({ error: "List not found" });
    return;
  }
  if (list.ownerId !== callerId) {
    res.status(403).json({ error: "You don't own this list" });
    return;
  }

  const updates: { name?: string; description?: string | null } = {};
  if (parsed.data.name !== undefined) {
    const name = parsed.data.name.trim();
    if (!name) {
      res.status(400).json({ error: "List name cannot be empty" });
      return;
    }
    updates.name = name;
  }
  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description?.trim() || null;
  }

  const [updated] =
    Object.keys(updates).length > 0
      ? await db
          .update(listsTable)
          .set(updates)
          .where(eq(listsTable.id, list.id))
          .returning()
      : [list];

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listItemsTable)
    .where(eq(listItemsTable.listId, list.id));

  res.json(
    UpdateListResponse.parse({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      ownerId: updated.ownerId,
      ownerName: updated.ownerName,
      itemCount: count,
      createdAt: updated.createdAt.toISOString(),
    }),
  );
});

router.delete("/lists/:id", async (req: AuthedRequest, res): Promise<void> => {
  const params = DeleteListParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const callerId = req.userId!;
  const [list] = await db
    .select()
    .from(listsTable)
    .where(eq(listsTable.id, params.data.id));

  if (!list) {
    res.status(404).json({ error: "List not found" });
    return;
  }
  if (list.ownerId !== callerId) {
    res.status(403).json({ error: "You don't own this list" });
    return;
  }

  await db.delete(listsTable).where(eq(listsTable.id, list.id));
  res.sendStatus(204);
});

router.post(
  "/lists/:id/items",
  async (req: AuthedRequest, res): Promise<void> => {
    const params = AddListItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = AddListItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const callerId = req.userId!;
    const [list] = await db
      .select()
      .from(listsTable)
      .where(eq(listsTable.id, params.data.id));

    if (!list) {
      res.status(404).json({ error: "List not found" });
      return;
    }
    if (list.ownerId !== callerId) {
      res.status(403).json({ error: "You don't own this list" });
      return;
    }

    const title = parsed.data.title.trim();
    if (!title) {
      res.status(400).json({ error: "Title cannot be empty" });
      return;
    }

    const [item] = await db
      .insert(listItemsTable)
      .values({
        listId: list.id,
        title,
        mediaType: parsed.data.mediaType,
      })
      .returning({
        id: listItemsTable.id,
        title: listItemsTable.title,
        mediaType: listItemsTable.mediaType,
      });

    res.status(201).json(item);
  },
);

router.delete(
  "/lists/:id/items/:itemId",
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeleteListItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const callerId = req.userId!;
    const [list] = await db
      .select()
      .from(listsTable)
      .where(eq(listsTable.id, params.data.id));

    if (!list) {
      res.status(404).json({ error: "List not found" });
      return;
    }
    if (list.ownerId !== callerId) {
      res.status(403).json({ error: "You don't own this list" });
      return;
    }

    const [deleted] = await db
      .delete(listItemsTable)
      .where(
        and(
          eq(listItemsTable.id, params.data.itemId),
          eq(listItemsTable.listId, list.id),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
