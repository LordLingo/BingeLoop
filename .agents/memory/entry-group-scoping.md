---
name: Entry group-scoping contract
description: How entries are scoped to groups vs cross-group member views, and the unassigned/triage path.
---

# Entry group-scoping

`entries` carries a nullable `groupId`. Scoping rules in `GET /entries` and `GET /stats`:

- `groupId=X` branch: filter `eq(entries.groupId, X)` and require caller `isMember(X)`. This is the GROUP LIBRARY + hero stats. It is NOT the member-set ("everyone who shares a group") — that was the original bug: entries were tied only to userId/addedBy, so a user's entries showed up in EVERY group they belonged to.
- `userId=U` branch: cross-group — returns ALL of U's entries regardless of groupId, allowed only when caller `usersShareGroup(U)`. This powers the member-profile view and must stay cross-group.
- default (no param): caller-only (`eq(entries.userId, callerId)`), across all the caller's groups.
- `unassigned=true`: caller-owned `isNull(groupId)` — legacy/group-less entries.

**Why:** users belong to multiple groups; an entry belongs to the one group it was logged in, not all of them.

**How to apply:**
- POST persists `groupId` (active group, or null); if a `groupId` is given, check `isMember` BEFORE insert (403 leaves no side effect).
- PATCH allows reassigning `groupId` for triage; check ownership then `isMember` of the target group before the update.
- `groupId` is kept NULLABLE (NOT NULL push fails on populated tables); NULL = unassigned, surfaced via the `/unassigned` triage page + Home banner.
- Out of scope (still member-set scoped): audiences, watchlist alsoEngagedBy, comments, reactions.
