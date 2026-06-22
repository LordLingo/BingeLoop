import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  db,
  invitesTable,
  groupsTable,
  groupMembersTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { resolveDisplayName } from "../lib/displayName";
import { getMembership } from "../lib/groups";
import {
  CreateOrGetGroupInviteParams,
  CreateOrGetGroupInviteResponse,
  GetInvitePreviewResponse,
  AcceptInviteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function newToken(): string {
  return randomBytes(16).toString("base64url");
}

router.post(
  "/groups/:id/invite",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = CreateOrGetGroupInviteParams.safeParse(req.params);
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

    let [invite] = await db
      .select()
      .from(invitesTable)
      .where(eq(invitesTable.groupId, groupId));

    if (!invite) {
      const createdByName = await resolveDisplayName(userId);
      [invite] = await db
        .insert(invitesTable)
        .values({
          token: newToken(),
          groupId,
          createdBy: userId,
          createdByName,
        })
        .onConflictDoNothing({ target: invitesTable.groupId })
        .returning();

      if (!invite) {
        [invite] = await db
          .select()
          .from(invitesTable)
          .where(eq(invitesTable.groupId, groupId));
      }
    }

    res.json(
      CreateOrGetGroupInviteResponse.parse({
        token: invite.token,
        groupId: group.id,
        groupName: group.name,
        createdAt: invite.createdAt.toISOString(),
      }),
    );
  },
);

router.get("/invites/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token);

  const [row] = await db
    .select({
      createdByName: invitesTable.createdByName,
      groupName: groupsTable.name,
    })
    .from(invitesTable)
    .innerJoin(groupsTable, eq(invitesTable.groupId, groupsTable.id))
    .where(eq(invitesTable.token, token));

  res.json(
    GetInvitePreviewResponse.parse({
      token,
      groupName: row?.groupName ?? "",
      inviterName: row?.createdByName ?? "",
      valid: !!row,
    }),
  );
});

router.post(
  "/invites/:token/accept",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    const token = String(req.params.token);
    const userId = req.userId!;

    const [invite] = await db
      .select()
      .from(invitesTable)
      .where(eq(invitesTable.token, token));

    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    const [group] = await db
      .select()
      .from(groupsTable)
      .where(eq(groupsTable.id, invite.groupId));

    if (!group) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    const existing = await getMembership(group.id, userId);
    let joined = false;
    if (!existing) {
      // A previously-removed member keeps their row (status="removed"); rejoining
      // via an invite reactivates that row instead of inserting a duplicate
      // (which would conflict on the unique (groupId, userId) index).
      const [priorRow] = await db
        .select()
        .from(groupMembersTable)
        .where(
          and(
            eq(groupMembersTable.groupId, group.id),
            eq(groupMembersTable.userId, userId),
          ),
        );
      if (priorRow) {
        await db
          .update(groupMembersTable)
          .set({ status: "active" })
          .where(eq(groupMembersTable.id, priorRow.id));
        joined = true;
      } else {
        const displayName = await resolveDisplayName(userId);
        const inserted = await db
          .insert(groupMembersTable)
          .values({ groupId: group.id, userId, displayName, role: "member" })
          .onConflictDoNothing()
          .returning();
        joined = inserted.length > 0;
      }
    }

    res.json(
      AcceptInviteResponse.parse({
        joined,
        groupId: group.id,
        groupName: group.name,
      }),
    );
  },
);

export default router;
