import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// "Who Should Watch?" — each member picks one or more audiences a show suits.
// Stored as a text[] so a single row holds a member's full multi-select answer.
export const showAudiencesTable = pgTable(
  "show_audiences",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleKey: text("title_key").notNull(),
    mediaType: text("media_type").notNull(),
    audiences: text("audiences").array().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("audience_user_show_unique").on(
      table.userId,
      table.titleKey,
      table.mediaType,
    ),
  ],
);

export const insertShowAudienceSchema = createInsertSchema(
  showAudiencesTable,
).omit({ id: true, updatedAt: true });
export type InsertShowAudience = z.infer<typeof insertShowAudienceSchema>;
export type ShowAudienceRow = typeof showAudiencesTable.$inferSelect;
