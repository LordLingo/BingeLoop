import { Router, type IRouter } from "express";
import { eq, and, gt, lte, ne, count, sql } from "drizzle-orm";
import { db, entriesTable, userActivityTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { CheckInResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

router.post(
  "/activity/check-in",
  async (req: AuthedRequest, res): Promise<void> => {
    const userId = req.userId!;

    const [existing] = await db
      .select()
      .from(userActivityTable)
      .where(eq(userActivityTable.userId, userId));

    const since = existing?.lastSeenAt ?? null;
    const now = new Date();

    let newCount = 0;
    if (since) {
      const [row] = await db
        .select({ value: count() })
        .from(entriesTable)
        .where(
          and(
            gt(entriesTable.createdAt, since),
            lte(entriesTable.createdAt, now),
            ne(entriesTable.userId, userId),
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
