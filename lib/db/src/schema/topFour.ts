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

// A member's "Top Four" all-time favorites. Each row is one pick at a fixed
// position (0-3); the whole set is replaced atomically on update. Titles are
// free-text (NOT tied to logged entries), so there is no titleKey/entry FK —
// a pick is just a display title plus a movie/tv media type.
export const topFourTable = pgTable(
  "top_four",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    mediaType: text("media_type").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("top_four_user_position_unique").on(
      table.userId,
      table.position,
    ),
  ],
);

export const insertTopFourSchema = createInsertSchema(topFourTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertTopFour = z.infer<typeof insertTopFourSchema>;
export type TopFour = typeof topFourTable.$inferSelect;
