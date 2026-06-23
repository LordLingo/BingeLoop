import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const entriesTable = pgTable("entries", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  mediaType: text("media_type").notNull(),
  rating: integer("rating").notNull(),
  category: text("category").notNull(),
  comment: text("comment"),
  userId: text("user_id").notNull(),
  addedBy: text("added_by").notNull(),
  groupId: integer("group_id"),
  tmdbId: integer("tmdb_id"),
  posterPath: text("poster_path"),
  streamingProvider: text("streaming_provider"),
  streamingLogo: text("streaming_logo"),
  network: text("network"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEntrySchema = createInsertSchema(entriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type Entry = typeof entriesTable.$inferSelect;
