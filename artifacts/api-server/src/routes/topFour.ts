import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, topFourTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { usersShareGroup } from "../lib/groups";
import {
  ListTopFourQueryParams,
  ListTopFourResponse,
  SetTopFourBody,
  SetTopFourResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/top-four", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListTopFourQueryParams.safeParse(req.query);
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

  const rows = await db
    .select({
      position: topFourTable.position,
      title: topFourTable.title,
      mediaType: topFourTable.mediaType,
    })
    .from(topFourTable)
    .where(eq(topFourTable.userId, targetUserId))
    .orderBy(asc(topFourTable.position));

  res.json(ListTopFourResponse.parse(rows));
});

router.put("/top-four", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = SetTopFourBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callerId = req.userId!;
  // Normalize: trim titles, drop blanks, cap at 4, reindex positions 0..3 by
  // the caller's chosen order so display order is always contiguous.
  const picks = parsed.data.picks
    .map((p) => ({ title: p.title.trim(), mediaType: p.mediaType }))
    .filter((p) => p.title.length > 0)
    .slice(0, 4)
    .map((p, index) => ({
      userId: callerId,
      position: index,
      title: p.title,
      mediaType: p.mediaType,
    }));

  // Replace the whole set atomically so reordering and removals are clean.
  await db.transaction(async (tx) => {
    await tx.delete(topFourTable).where(eq(topFourTable.userId, callerId));
    if (picks.length > 0) {
      await tx.insert(topFourTable).values(picks);
    }
  });

  res.json(
    SetTopFourResponse.parse(
      picks.map((p) => ({
        position: p.position,
        title: p.title,
        mediaType: p.mediaType,
      })),
    ),
  );
});

export default router;
