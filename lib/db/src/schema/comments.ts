import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const showCommentsTable = pgTable(
  "show_comments",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    authorName: text("author_name").notNull(),
    titleKey: text("title_key").notNull(),
    mediaType: text("media_type").notNull(),
    parentId: integer("parent_id").references(
      (): AnyPgColumn => showCommentsTable.id,
      { onDelete: "cascade" },
    ),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("comments_show_idx").on(table.titleKey, table.mediaType)],
);

export type ShowComment = typeof showCommentsTable.$inferSelect;
