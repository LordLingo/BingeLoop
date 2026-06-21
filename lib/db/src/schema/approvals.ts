import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const showApprovalsTable = pgTable(
  "show_approvals",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleKey: text("title_key").notNull(),
    mediaType: text("media_type").notNull(),
    approval: text("approval").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("approval_user_show_unique").on(
      table.userId,
      table.titleKey,
      table.mediaType,
    ),
  ],
);

export const insertShowApprovalSchema = createInsertSchema(
  showApprovalsTable,
).omit({ id: true, updatedAt: true });
export type InsertShowApproval = z.infer<typeof insertShowApprovalSchema>;
export type ShowApproval = typeof showApprovalsTable.$inferSelect;
