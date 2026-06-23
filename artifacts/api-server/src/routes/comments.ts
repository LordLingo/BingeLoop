import { Router, type IRouter } from "express";
import { eq, and, asc, inArray } from "drizzle-orm";
import { db, showCommentsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { getGroupMemberIds, getMembership } from "../lib/groups";
import { resolveDisplayName } from "../lib/displayName";
import {
  ListCommentsQueryParams,
  ListCommentsResponse,
  ListCommentsResponseItem,
  CreateCommentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

// Returns the member ids whose comments are visible to this caller for a show:
// just the caller when no group is given, or all members of the group. Returns
// null when the caller passed a group they don't belong to, so the route can
// respond with a 403 (consistent with /entries, /stats, /audiences, /spice).
async function resolveMemberIds(
  callerId: string,
  groupId: number | undefined,
): Promise<string[] | null> {
  if (groupId === undefined) return [callerId];
  const membership = await getMembership(groupId, callerId);
  if (!membership) return null;
  return getGroupMemberIds(groupId);
}

router.get("/comments", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListCommentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const titleKey = normalizeTitle(parsed.data.title);
  const { mediaType } = parsed.data;

  const memberIds = await resolveMemberIds(callerId, parsed.data.groupId);
  if (memberIds === null) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  const rows = await db
    .select({
      id: showCommentsTable.id,
      parentId: showCommentsTable.parentId,
      authorName: showCommentsTable.authorName,
      body: showCommentsTable.body,
      createdAt: showCommentsTable.createdAt,
    })
    .from(showCommentsTable)
    .where(
      and(
        inArray(showCommentsTable.userId, memberIds),
        eq(showCommentsTable.titleKey, titleKey),
        eq(showCommentsTable.mediaType, mediaType),
      ),
    )
    .orderBy(asc(showCommentsTable.createdAt));

  res.json(ListCommentsResponse.parse(rows));
});

router.post("/comments", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  const titleKey = normalizeTitle(parsed.data.title);
  const { mediaType, body, parentId } = parsed.data;

  // Membership/authorization must be confirmed BEFORE any mutation, so a 403
  // leaves no side effects.
  const memberIds = await resolveMemberIds(callerId, parsed.data.groupId);
  if (memberIds === null) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  // A reply must target a comment on the SAME show that is visible to the
  // caller (authored by a member of the resolved set).
  if (parentId !== undefined && parentId !== null) {
    const [parent] = await db
      .select({
        userId: showCommentsTable.userId,
        titleKey: showCommentsTable.titleKey,
        mediaType: showCommentsTable.mediaType,
      })
      .from(showCommentsTable)
      .where(eq(showCommentsTable.id, parentId));

    if (
      !parent ||
      parent.titleKey !== titleKey ||
      parent.mediaType !== mediaType ||
      !memberIds.includes(parent.userId)
    ) {
      res.status(400).json({ error: "Invalid parent comment" });
      return;
    }
  }

  const authorName = await resolveDisplayName(callerId);

  const [created] = await db
    .insert(showCommentsTable)
    .values({
      userId: callerId,
      authorName,
      titleKey,
      mediaType,
      parentId: parentId ?? null,
      body,
    })
    .returning({
      id: showCommentsTable.id,
      parentId: showCommentsTable.parentId,
      authorName: showCommentsTable.authorName,
      body: showCommentsTable.body,
      createdAt: showCommentsTable.createdAt,
    });

  res.status(201).json(ListCommentsResponseItem.parse(created));
});

export default router;
