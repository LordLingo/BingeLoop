import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const showSpiceTable = pgTable(
  "show_spice",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleKey: text("title_key").notNull(),
    mediaType: text("media_type").notNull(),
    spicy: text("spicy").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("spice_user_show_unique").on(
      table.userId,
      table.titleKey,
      table.mediaType,
    ),
  ],
);

export const insertShowSpiceSchema = createInsertSchema(showSpiceTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertShowSpice = z.infer<typeof insertShowSpiceSchema>;
export type ShowSpice = typeof showSpiceTable.$inferSelect;
