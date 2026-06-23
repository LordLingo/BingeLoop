import { Router, type IRouter } from "express";
import { and, eq, ne, inArray, sql } from "drizzle-orm";
import { db, groupMembersTable, groupsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import {
  getProfileDisplayName,
  setDisplayNameAndPropagate,
} from "../lib/displayName";
import { getMemberGroupIds } from "../lib/groups";
import { isAdminUser } from "../lib/admin";
import {
  GetProfileResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth);

// Returns the name of the FIRST active group (among the caller's groups) where
// another ACTIVE member already uses `name` (case-insensitive), or null if the
// name is free across all of the caller's groups. Used to keep display names
// unique within each group.
async function conflictingGroupName(
  userId: string,
  name: string,
): Promise<string | null> {
  const groupIds = await getMemberGroupIds(userId);
  if (groupIds.length === 0) return null;

  const [row] = await db
    .select({ groupName: groupsTable.name })
    .from(groupMembersTable)
    .innerJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
    .where(
      and(
        inArray(groupMembersTable.groupId, groupIds),
        eq(groupMembersTable.status, "active"),
        ne(groupMembersTable.userId, userId),
        sql`lower(${groupMembersTable.displayName}) = lower(${name})`,
      ),
    )
    .limit(1);

  return row?.groupName ?? null;
}

router.get("/profile", async (req: AuthedRequest, res): Promise<void> => {
  const [displayName, isAdmin] = await Promise.all([
    getProfileDisplayName(req.userId!),
    isAdminUser(req.userId!),
  ]);
  res.json(GetProfileResponse.parse({ displayName, isAdmin }));
});

router.put("/profile", async (req: AuthedRequest, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const displayName = parsed.data.displayName.trim();
  if (!displayName) {
    res.status(400).json({ error: "Display name cannot be blank" });
    return;
  }

  const conflict = await conflictingGroupName(userId, displayName);
  if (conflict) {
    res.status(409).json({
      error: `That name is already taken in "${conflict}". Please pick another.`,
      code: "name_taken",
    });
    return;
  }

  await setDisplayNameAndPropagate(userId, displayName);

  const isAdmin = await isAdminUser(userId);
  res.json(UpdateProfileResponse.parse({ displayName, isAdmin }));
});

export default router;
