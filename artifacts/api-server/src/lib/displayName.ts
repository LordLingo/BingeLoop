import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  groupMembersTable,
  entriesTable,
  showCommentsTable,
  listsTable,
  invitesTable,
  watchlistItemsTable,
} from "@workspace/db";

// Resolve the name to show for a user. Order:
//   1. The user's chosen profile display name (single source of truth).
//   2. Clerk first name (NEVER email/username/last name — emails must stay private).
//   3. A generic "Member" fallback.
// New accounts are forced to set a display name before using the app, so (2)/(3)
// are only hit for legacy rows or as a safety net — and never leak an email.
export async function resolveDisplayName(userId: string): Promise<string> {
  const [profile] = await db
    .select({ displayName: userProfilesTable.displayName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  if (profile?.displayName) return profile.displayName;

  try {
    const user = await clerkClient.users.getUser(userId);
    const first = (user.firstName ?? "").trim();
    if (first) return first;
  } catch {
    // Clerk lookup failed — fall through to the generic fallback.
  }
  return "Member";
}

// Read the user's chosen profile name, or null if they haven't set one yet.
export async function getProfileDisplayName(
  userId: string,
): Promise<string | null> {
  const [profile] = await db
    .select({ displayName: userProfilesTable.displayName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  return profile?.displayName ?? null;
}

// Upsert the user's profile display name and fan the new name out to every
// denormalized snapshot so the user appears consistently everywhere with no
// read-path rewrites. All writes run in one transaction. NOTE: any future table
// that snapshots a user's name must be added here to stay in sync.
export async function setDisplayNameAndPropagate(
  userId: string,
  displayName: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(userProfilesTable)
      .values({ userId, displayName })
      .onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: { displayName, updatedAt: new Date() },
      });

    await tx
      .update(groupMembersTable)
      .set({ displayName })
      .where(eq(groupMembersTable.userId, userId));
    await tx
      .update(entriesTable)
      .set({ addedBy: displayName })
      .where(eq(entriesTable.userId, userId));
    await tx
      .update(watchlistItemsTable)
      .set({ addedBy: displayName })
      .where(eq(watchlistItemsTable.userId, userId));
    await tx
      .update(showCommentsTable)
      .set({ authorName: displayName })
      .where(eq(showCommentsTable.userId, userId));
    await tx
      .update(listsTable)
      .set({ ownerName: displayName })
      .where(eq(listsTable.ownerId, userId));
    await tx
      .update(invitesTable)
      .set({ createdByName: displayName })
      .where(eq(invitesTable.createdBy, userId));
  });
}
