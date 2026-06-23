---
name: Display name snapshot fan-out
description: How user display names propagate across denormalized snapshot tables, and the email-privacy rule.
---

# Display name = single source of truth + write-time fan-out

`user_profiles.displayName` is the single source of truth for a user's name.
The name is DENORMALIZED into many snapshot columns so read paths never resolve
names: `group_members.displayName`, `entries.addedBy`, `watchlist_items.addedBy`,
`show_comments.authorName`, `lists.ownerName`, `invites.createdByName`.

**Rule:** any code that snapshots a user's name on write MUST derive it from
`resolveDisplayName(userId)` (profile → Clerk firstName → "Member"), and any NEW
table that snapshots a name MUST be added to `setDisplayNameAndPropagate`'s
transaction. If you add a snapshot column but forget the fan-out, a rename leaves
that surface stale.

**Why:** there is no read-time name resolution, so a missed fan-out surface
silently shows the old name forever. A missed `resolveDisplayName` usage (e.g.
the old `watchlist.ts` POST built `addedBy` from Clerk with an
`primaryEmailAddress` fallback) can leak a user's EMAIL into group-visible UI —
emails must never be shown publicly. Fallback is firstName, never email.

**How to apply:** when adding a feature that stores a user's name, grep for
`resolveDisplayName` and `setDisplayNameAndPropagate` and wire both. Never build a
name from Clerk email/username/lastName.

# Per-group uniqueness is app-level, not a DB constraint

Display-name uniqueness within a group is enforced by check-then-write in
`PUT /profile` (across the caller's active groups) and invite-accept (target
group), both case-insensitive via `lower()`. There is intentionally NO DB unique
index on `(groupId, lower(displayName))` — legacy `group_members` rows can share
fallback names like multiple `"Member"`, which such an index would reject.
