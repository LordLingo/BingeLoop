import { Router, type IRouter } from "express";
import { eq, and, inArray, asc, count } from "drizzle-orm";
import {
  db,
  groupsTable,
  groupMembersTable,
  invitesTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { resolveDisplayName } from "../lib/displayName";
import { getMembership } from "../lib/groups";
import {
  ListGroupsResponse,
  ListGroupsResponseItem,
  CreateGroupBody,
  GetGroupParams,
  GetGroupResponse,
  RenameGroupParams,
  RenameGroupBody,
  RenameGroupResponse,
  LeaveGroupParams,
  RemoveGroupMemberParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

// Active members only. Removed members keep their row (status="removed") so their
// content stays visible, but they are not counted/listed as members.
async function memberCount(groupId: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.status, "active"),
      ),
    );
  return row?.value ?? 0;
}

router.get("/groups", async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;

  const memberships = await db
    .select({
      groupId: groupMembersTable.groupId,
      role: groupMembersTable.role,
    })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.userId, userId),
        eq(groupMembersTable.status, "active"),
      ),
    );

  if (memberships.length === 0) {
    res.json(ListGroupsResponse.parse([]));
    return;
  }

  const ids = memberships.map((m) => m.groupId);
  const roleById = new Map(memberships.map((m) => [m.groupId, m.role]));

  const groups = await db
    .select()
    .from(groupsTable)
    .where(inArray(groupsTable.id, ids))
    .orderBy(asc(groupsTable.createdAt));

  const counts = await db
    .select({ groupId: groupMembersTable.groupId, value: count() })
    .from(groupMembersTable)
    .where(
      and(
        inArray(groupMembersTable.groupId, ids),
        eq(groupMembersTable.status, "active"),
      ),
    )
    .groupBy(groupMembersTable.groupId);
  const countById = new Map(counts.map((c) => [c.groupId, c.value]));

  const result = groups.map((g) => ({
    id: g.id,
    name: g.name,
    ownerId: g.ownerId,
    role: roleById.get(g.id) === "owner" ? "owner" : "member",
    memberCount: countById.get(g.id) ?? 0,
    createdAt: g.createdAt.toISOString(),
  }));

  res.json(ListGroupsResponse.parse(result));
});

router.post("/groups", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const displayName = await resolveDisplayName(userId);
  const name = parsed.data.name.trim();

  const [group] = await db
    .insert(groupsTable)
    .values({ name, ownerId: userId })
    .returning();

  await db.insert(groupMembersTable).values({
    groupId: group.id,
    userId,
    displayName,
    role: "owner",
  });

  res.status(201).json(
    ListGroupsResponseItem.parse({
      id: group.id,
      name: group.name,
      ownerId: group.ownerId,
      role: "owner",
      memberCount: 1,
      createdAt: group.createdAt.toISOString(),
    }),
  );
});

router.get("/groups/:id", async (req: AuthedRequest, res): Promise<void> => {
  const params = GetGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.userId!;
  const groupId = params.data.id;

  const membership = await getMembership(groupId, userId);
  if (!membership) {
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId));
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const members = await db
    .select()
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.status, "active"),
      ),
    )
    .orderBy(asc(groupMembersTable.joinedAt));

  res.json(
    GetGroupResponse.parse({
      id: group.id,
      name: group.name,
      ownerId: group.ownerId,
      role: membership.role === "owner" ? "owner" : "member",
      memberCount: members.length,
      createdAt: group.createdAt.toISOString(),
      members: members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        role: m.role === "owner" ? "owner" : "member",
        joinedAt: m.joinedAt.toISOString(),
      })),
    }),
  );
});

router.patch("/groups/:id", async (req: AuthedRequest, res): Promise<void> => {
  const params = RenameGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RenameGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const groupId = params.data.id;

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId));
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  if (group.ownerId !== userId) {
    res.status(403).json({ error: "Only the owner can rename this group" });
    return;
  }

  const name = parsed.data.name.trim();
  const [updated] = await db
    .update(groupsTable)
    .set({ name })
    .where(eq(groupsTable.id, groupId))
    .returning();

  res.json(
    RenameGroupResponse.parse({
      id: updated.id,
      name: updated.name,
      ownerId: updated.ownerId,
      role: "owner",
      memberCount: await memberCount(groupId),
      createdAt: updated.createdAt.toISOString(),
    }),
  );
});

router.post(
  "/groups/:id/leave",
  async (req: AuthedRequest, res): Promise<void> => {
    const params = LeaveGroupParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = req.userId!;
    const groupId = params.data.id;

    const membership = await getMembership(groupId, userId);
    if (!membership) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    await db
      .delete(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.groupId, groupId),
          eq(groupMembersTable.userId, userId),
        ),
      );

    const remaining = await db
      .select()
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.groupId, groupId),
          eq(groupMembersTable.status, "active"),
        ),
      )
      .orderBy(asc(groupMembersTable.joinedAt));

    if (remaining.length === 0) {
      // No active members left: tear the group down, including any removed-member
      // rows still attached to it.
      await db
        .delete(groupMembersTable)
        .where(eq(groupMembersTable.groupId, groupId));
      await db.delete(invitesTable).where(eq(invitesTable.groupId, groupId));
      await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
    } else if (membership.role === "owner") {
      const next = remaining[0];
      await db
        .update(groupsTable)
        .set({ ownerId: next.userId })
        .where(eq(groupsTable.id, groupId));
      await db
        .update(groupMembersTable)
        .set({ role: "owner" })
        .where(eq(groupMembersTable.id, next.id));
    }

    res.sendStatus(204);
  },
);

router.delete(
  "/groups/:id/members/:userId",
  async (req: AuthedRequest, res): Promise<void> => {
    const params = RemoveGroupMemberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const callerId = req.userId!;
    const groupId = params.data.id;
    const targetUserId = params.data.userId;

    const [group] = await db
      .select()
      .from(groupsTable)
      .where(eq(groupsTable.id, groupId));
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    if (group.ownerId !== callerId) {
      res
        .status(403)
        .json({ error: "Only the owner can remove members" });
      return;
    }
    if (targetUserId === callerId) {
      res.status(400).json({ error: "You cannot remove yourself" });
      return;
    }

    // Must be an ACTIVE member to remove.
    const [target] = await db
      .select()
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.groupId, groupId),
          eq(groupMembersTable.userId, targetUserId),
          eq(groupMembersTable.status, "active"),
        ),
      );
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    // Soft-remove: keep the row (and its displayName snapshot) so the member's
    // contributed content stays visible to the group, but revoke their access.
    await db
      .update(groupMembersTable)
      .set({ status: "removed" })
      .where(eq(groupMembersTable.id, target.id));

    res.sendStatus(204);
  },
);

export default router;
