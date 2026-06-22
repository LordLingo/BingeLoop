import { and, eq, inArray } from "drizzle-orm";
import { db, groupMembersTable } from "@workspace/db";

// Groups where the user is an ACTIVE member (i.e. has access). Removed members
// keep their row (status="removed") so their content stays visible, but they no
// longer "belong to" the group for access purposes.
export async function getMemberGroupIds(userId: string): Promise<number[]> {
  const rows = await db
    .select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.userId, userId),
        eq(groupMembersTable.status, "active"),
      ),
    );
  return rows.map((r) => r.groupId);
}

// ACCESS check: returns the caller's ACTIVE membership row only. A removed
// member resolves to undefined and is treated as a non-member everywhere access
// is gated (reading the group, group-scoped reads/writes, invites, etc.).
export async function getMembership(groupId: number, userId: string) {
  const [row] = await db
    .select()
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId),
        eq(groupMembersTable.status, "active"),
      ),
    );
  return row;
}

export async function isMember(
  groupId: number,
  userId: string,
): Promise<boolean> {
  return !!(await getMembership(groupId, userId));
}

// CONTENT set: ALL contributor ids for the group, INCLUDING removed members.
// Used to scope group-wide reads (entries, stats, approvals, etc.) so a removed
// member's contributions remain visible to the rest of the group.
export async function getGroupMemberIds(groupId: number): Promise<string[]> {
  const rows = await db
    .select({ userId: groupMembersTable.userId })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, groupId));
  return rows.map((r) => r.userId);
}

// Asymmetric on purpose: the CALLER (userA) must be an ACTIVE member of a shared
// group, while the TARGET (userB) may be active OR removed in that group. This
// lets active members view a removed contributor's content, while a removed
// caller (no active membership) can no longer see anyone else's content.
export async function usersShareGroup(
  userA: string,
  userB: string,
): Promise<boolean> {
  if (userA === userB) return true;
  const aGroups = await getMemberGroupIds(userA);
  if (aGroups.length === 0) return false;
  const [shared] = await db
    .select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.userId, userB),
        inArray(groupMembersTable.groupId, aGroups),
      ),
    )
    .limit(1);
  return !!shared;
}
