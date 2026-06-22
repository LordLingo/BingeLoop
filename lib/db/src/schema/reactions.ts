import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Lightweight emoji reactions on either an entry (rating) or a comment.
// Polymorphic by (targetType, targetId): one row per (user, target, emoji),
// so a user may stack several distinct emojis on the same target but each
// emoji only once. Visibility is group-scoped at read time (see routes).
export const reactionsTable = pgTable(
  "reactions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("reactions_user_target_emoji_unique").on(
      table.userId,
      table.targetType,
      table.targetId,
      table.emoji,
    ),
    index("reactions_target_idx").on(table.targetType, table.targetId),
  ],
);

export type Reaction = typeof reactionsTable.$inferSelect;
