import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entriesTable } from "./entries";

// Per-member ratings on a show. Each member can give their OWN 1-5 rating to an
// entry (not just the person who added it). One row per (entry, user); upserted
// on the unique index. The show's displayed rating is the average across these
// rows, with the count of raters. The original submitter's legacy
// entries.rating was backfilled here as that person's personal rating.
export const entryRatingsTable = pgTable(
  "entry_ratings",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    rating: integer("rating").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("entry_ratings_entry_user_unique").on(
      table.entryId,
      table.userId,
    ),
    index("entry_ratings_entry_idx").on(table.entryId),
    index("entry_ratings_user_idx").on(table.userId),
  ],
);

export const insertEntryRatingSchema = createInsertSchema(entryRatingsTable).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  },
);
export type InsertEntryRating = z.infer<typeof insertEntryRatingSchema>;
export type EntryRating = typeof entryRatingsTable.$inferSelect;
