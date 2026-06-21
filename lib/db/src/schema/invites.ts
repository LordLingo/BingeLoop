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
    createdBy: text("created_by").notNull(),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("invites_created_by_unique").on(table.createdBy)],
);

export const inviteAcceptancesTable = pgTable(
  "invite_acceptances",
  {
    id: serial("id").primaryKey(),
    inviteId: integer("invite_id").notNull(),
    userId: text("user_id").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("invite_acceptance_unique").on(table.inviteId, table.userId),
  ],
);

export const insertInviteSchema = createInsertSchema(invitesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invitesTable.$inferSelect;
export type InviteAcceptance = typeof inviteAcceptancesTable.$inferSelect;
