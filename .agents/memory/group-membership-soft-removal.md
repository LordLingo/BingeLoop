---
name: Group membership soft-removal (access vs content split)
description: How "remove member" works without deleting their content; which helpers gate access vs scope content.
---

# Group membership: access set vs content set

`group_members.status` (`active` | `removed`, default `active`) drives a deliberate split:

- **ACCESS helpers filter `status="active"`**: `getMemberGroupIds`, `getMembership`, `isMember`. A removed member resolves as a non-member everywhere access is gated (listing/reading/switching groups, every group-scoped read/write → 403).
- **CONTENT-set helper returns ALL rows (incl. removed)**: `getGroupMemberIds`. This is what scopes group-wide reads (entries/stats/approvals/spice/lists/comments/activity/watchlist `alsoEngagedBy`), so a removed member's contributions stay visible **inside that group's own (`groupId`-scoped) views** under their snapshot name.

**Why:** the product requirement is "revoke access but keep their contributed content visible to the rest of the group." Hard-deleting the `group_members` row would do both at once (group scoping keys off current membership), so removal must be a soft status flip, not a delete.

**`usersShareGroup(caller, target)` is now SYMMETRIC (both must be currently ACTIVE in a shared group).** It delegates to `sharedActiveGroupIds(a,b)`. This was changed for privacy: a soft-removed member's *cross-user* content (member-profile entries/stats, watchlist, top-four, lists, direct `/entries/:id`) is hidden from everyone except themselves once they share no active group. Removed-member content still shows in the group's own `groupId`-scoped library/stats (retention there is unaffected because that path filters by `entries.groupId`, not by `usersShareGroup`).

**How to apply (gotchas when touching group membership):**
- Anything that counts/lists "members" for ACCESS or display must filter `status="active"` (GET /groups list+counts, GET /groups/:id members+memberCount, leave route's "remaining"/ownership-transfer).
- Anything scoping WHOSE CONTENT shows must use `getGroupMemberIds` (no status filter).
- Rejoin via invite must REACTIVATE the existing `removed` row (set `status="active"`), never insert — `unique(groupId, userId)` would conflict.
- When the last ACTIVE member leaves, tear down leftover `removed` rows too before deleting the group.
