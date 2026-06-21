import { Router, type IRouter } from "express";
import { eq, and, gt, lte, inArray, count, sql } from "drizzle-orm";
import { db, entriesTable, userActivityTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { getGroupMemberIds, getMembership } from "../lib/groups";
import { CheckInQueryParams, CheckInResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

router.post(
  "/activity/check-in",
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = CheckInQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = req.userId!;

    const [existing] = await db
      .select()
      .from(userActivityTable)
      .where(eq(userActivityTable.userId, userId));

    const since = existing?.lastSeenAt ?? null;
    const now = new Date();

    // Other members of the chosen group whose new entries we count.
    let otherMemberIds: string[] = [];
    if (parsed.data.groupId !== undefined) {
      const membership = await getMembership(parsed.data.groupId, userId);
      if (membership) {
        otherMemberIds = (
          await getGroupMemberIds(parsed.data.groupId)
        ).filter((id) => id !== userId);
      }
    }

    let newCount = 0;
    if (since && otherMemberIds.length > 0) {
      const [row] = await db
        .select({ value: count() })
        .from(entriesTable)
        .where(
          and(
            gt(entriesTable.createdAt, since),
            lte(entriesTable.createdAt, now),
            inArray(entriesTable.userId, otherMemberIds),
          ),
        );
      newCount = row?.value ?? 0;
    }

    await db
      .insert(userActivityTable)
      .values({ userId, lastSeenAt: now })
      .onConflictDoUpdate({
        target: userActivityTable.userId,
        set: {
          lastSeenAt: sql`GREATEST(${userActivityTable.lastSeenAt}, excluded.last_seen_at)`,
        },
      });

    res.json(
      CheckInResponse.parse({
        newCount,
        since: since ? since.toISOString() : null,
      }),
    );
  },
);

export default router;
