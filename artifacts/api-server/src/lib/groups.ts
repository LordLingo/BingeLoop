import { and, eq, inArray } from "drizzle-orm";
import { db, groupMembersTable } from "@workspace/db";

export async function getMemberGroupIds(userId: string): Promise<number[]> {
  const rows = await db
    .select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.userId, userId));
  return rows.map((r) => r.groupId);
}

export async function getMembership(groupId: number, userId: string) {
  const [row] = await db
    .select()
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId),
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

export async function getGroupMemberIds(groupId: number): Promise<string[]> {
  const rows = await db
    .select({ userId: groupMembersTable.userId })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, groupId));
  return rows.map((r) => r.userId);
}

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
