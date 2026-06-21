import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invitesTable = pgTable(
  "invites",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull().unique(),
    groupId: integer("group_id").notNull(),
    createdBy: text("created_by").notNull(),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("invites_group_unique").on(table.groupId)],
);

export const insertInviteSchema = createInsertSchema(invitesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invitesTable.$inferSelect;
