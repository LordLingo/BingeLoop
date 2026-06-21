---
name: Drizzle NOT NULL backfill
description: Adding a NOT NULL column to a populated table with drizzle-kit push
---

# Adding a NOT NULL column with drizzle-kit push

Adding a `.notNull()` column (no default) to a table that already has rows makes `drizzle-kit push` fail, because existing rows would violate the constraint.

**Why:** Postgres rejects the `ALTER TABLE ... ADD COLUMN ... NOT NULL` when existing rows can't be given a value.

**How to apply:** Before pushing, either delete the existing rows (fine for throwaway/seed data) or give the column a default / backfill it first. In this project the seed entries were placeholders, so clearing the `entries` table before push was acceptable.
