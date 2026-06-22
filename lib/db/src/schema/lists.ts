import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A member-curated named list (e.g. "Guys Night Picks"). Each list is owned by
// the member who created it (ownerId), with a display-name snapshot (ownerName)
// resolved from Clerk on create for attribution. Lists are PERSONAL like
// entries/watchlist — there is NO groupId column; visibility is by shared group
// (a list is browsable by anyone who shares a group with the owner).
export const listsTable = pgTable("lists", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  ownerName: text("owner_name").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// One movie/show inside a list. Titles are free-text (NOT tied to logged
// entries), so there is no titleKey/FK — an item is just a display title plus a
// movie/tv media type. Deleting the parent list cascades to its items.
export const listItemsTable = pgTable(
  "list_items",
  {
    id: serial("id").primaryKey(),
    listId: integer("list_id")
      .notNull()
      .references(() => listsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    mediaType: text("media_type").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("list_items_list_id_idx").on(table.listId)],
);

export const insertListSchema = createInsertSchema(listsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertList = z.infer<typeof insertListSchema>;
export type List = typeof listsTable.$inferSelect;

export const insertListItemSchema = createInsertSchema(listItemsTable).omit({
  id: true,
  addedAt: true,
});
export type InsertListItem = z.infer<typeof insertListItemSchema>;
export type ListItem = typeof listItemsTable.$inferSelect;
