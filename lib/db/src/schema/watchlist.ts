import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const watchlistItemsTable = pgTable(
  "watchlist_items",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    addedBy: text("added_by").notNull(),
    title: text("title").notNull(),
    titleKey: text("title_key").notNull(),
    mediaType: text("media_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("watchlist_user_show_unique").on(
      table.userId,
      table.titleKey,
      table.mediaType,
    ),
  ],
);

export const insertWatchlistItemSchema = createInsertSchema(
  watchlistItemsTable,
).omit({ id: true, createdAt: true });
export type InsertWatchlistItem = z.infer<typeof insertWatchlistItemSchema>;
export type WatchlistItem = typeof watchlistItemsTable.$inferSelect;
