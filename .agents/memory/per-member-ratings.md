---
name: Per-member ratings model
description: Ratings are per-member optional rows in entry_ratings; entries.rating is legacy and no longer read.
---

# Per-member ratings

Ratings moved from one-per-show (creator-owned, required) to PER-MEMBER OPTIONAL.

- Source of truth: `entry_ratings` (`entryId` FK→entries cascade, `userId`, `rating` 1–5, `unique(entryId,userId)`), one row per member per show. Set/change via `PUT /entries/{id}/rating`, clear via `DELETE /entries/{id}/rating`; both check entry visibility (`isMember(entry.groupId)` or `usersShareGroup` for legacy null-groupId) BEFORE writing (403 leaves no side effect).
- Entry API exposes `averageRating` (mean, null if none), `ratingCount`, and caller's `myRating`. `rating_high`/`rating_low` sort re-orders in JS with NULLS LAST (unrated always last).

**Trap — `entries.rating` is RETAINED but NO LONGER READ.** It is now NULLABLE and kept only as the backfill source. Do not re-read it, do not try to restore NOT NULL (push fails on populated tables anyway), and do not drop it without first confirming the backfill into `entry_ratings` is complete everywhere.

**Trap — production data backfill is a separate step.** `drizzle push` syncs schema only; it does NOT copy `entries.rating` into `entry_ratings`. After pushing schema to prod, run once (idempotent): `INSERT INTO entry_ratings(entry_id,user_id,rating,created_at,updated_at) SELECT id,user_id,rating,created_at,created_at FROM entries WHERE rating IS NOT NULL ON CONFLICT DO NOTHING;` Dev was already backfilled+verified (0 legacy rows missing).

**Why optional + per-member:** several members log/watch the same show and each wants their own score; the card shows the group average ("4.3 avg · 3 ratings") rather than only the creator's number.

See also: feed/digest + average scoping in [entry-group-scoping](entry-group-scoping.md).
