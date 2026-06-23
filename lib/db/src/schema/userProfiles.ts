import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per user: the user's chosen GLOBAL display name (nickname). This is
// the single source of truth for how a user appears throughout the app. The
// name is denormalized into per-content snapshots (group_members.displayName,
// entries.addedBy, show_comments.authorName, lists.ownerName,
// invites.createdByName); changing it fans out an UPDATE to all of those so the
// new name shows everywhere. Uniqueness is enforced PER GROUP at write time
// (case-insensitive), not by a DB constraint, since the same name may be used in
// different groups.
export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(
  userProfilesTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
