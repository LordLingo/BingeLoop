---
name: Group membership soft-removal (access vs content split)
description: How "remove member" works without deleting their content; which helpers gate access vs scope content.
---

# Group membership: access set vs content set

`group_members.status` (`active` | `removed`, default `active`) drives a deliberate split:

- **ACCESS helpers filter `status="active"`**: `getMemberGroupIds`, `getMembership`, `isMember`. A removed member resolves as a non-member everywhere access is gated (listing/reading/switching groups, every group-scoped read/write → 403).
- **CONTENT-set helper returns ALL rows (incl. removed)**: `getGroupMemberIds`. This is what scopes group-wide reads (entries/stats/approvals/spice/lists/comments/activity/watchlist `alsoEngagedBy`), so a removed member's personal `userId`-keyed content stays visible to the group under their snapshot name.

**Why:** the product requirement is "revoke access but keep their contributed content visible to the rest of the group." Hard-deleting the `group_members` row would do both at once (group scoping keys off current membership), so removal must be a soft status flip, not a delete.

**`usersShareGroup(caller, target)` is asymmetric on purpose:** caller must be ACTIVE in a shared group; target may be active OR removed. Lets active members open a removed contributor's `/member/:id`; a removed caller (no active membership) loses all cross-user visibility.

**How to apply (gotchas when touching group membership):**
- Anything that counts/lists "members" for ACCESS or display must filter `status="active"` (GET /groups list+counts, GET /groups/:id members+memberCount, leave route's "remaining"/ownership-transfer).
- Anything scoping WHOSE CONTENT shows must use `getGroupMemberIds` (no status filter).
- Rejoin via invite must REACTIVATE the existing `removed` row (set `status="active"`), never insert — `unique(groupId, userId)` would conflict.
- When the last ACTIVE member leaves, tear down leftover `removed` rows too before deleting the group.
