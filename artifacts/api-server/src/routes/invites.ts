import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { db, invitesTable, inviteAcceptancesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import {
  CreateOrGetInviteResponse,
  GetInvitePreviewResponse,
  AcceptInviteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function newToken(): string {
  return randomBytes(16).toString("base64url");
}

router.post(
  "/invites",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    const userId = req.userId!;

    let [invite] = await db
      .select()
      .from(invitesTable)
      .where(eq(invitesTable.createdBy, userId));

    if (!invite) {
      const user = await clerkClient.users.getUser(userId);
      const createdByName =
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        user.username ||
        user.primaryEmailAddress?.emailAddress ||
        "Unknown";

      [invite] = await db
        .insert(invitesTable)
        .values({ token: newToken(), createdBy: userId, createdByName })
        .onConflictDoNothing({ target: invitesTable.createdBy })
        .returning();

      if (!invite) {
        [invite] = await db
          .select()
          .from(invitesTable)
          .where(eq(invitesTable.createdBy, userId));
      }
    }

    res.json(
      CreateOrGetInviteResponse.parse({
        token: invite.token,
        createdByName: invite.createdByName,
        createdAt: invite.createdAt.toISOString(),
      }),
    );
  },
);

router.get("/invites/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token);

  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(eq(invitesTable.token, token));

  res.json(
    GetInvitePreviewResponse.parse({
      token,
      inviterName: invite?.createdByName ?? "",
      valid: !!invite,
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

    const joined = invite.createdBy !== userId;
    if (joined) {
      await db
        .insert(inviteAcceptancesTable)
        .values({ inviteId: invite.id, userId })
        .onConflictDoNothing();
    }

    res.json(
      AcceptInviteResponse.parse({
        joined,
        inviterName: invite.createdByName,
      }),
    );
  },
);

export default router;
