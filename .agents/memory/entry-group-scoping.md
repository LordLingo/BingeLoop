---
name: Entry group-scoping contract
description: How entries are scoped to groups vs cross-group member views, and the unassigned/triage path.
---

# Entry group-scoping

`entries` carries a nullable `groupId`. Scoping rules in `GET /entries` and `GET /stats`:

- `groupId=X` branch: require caller `isMember(X)`, then filter with `groupScopedFilter(X)` = `OR(eq(groupId,X), AND(isNull(groupId), inArray(userId, getActiveGroupMemberIds(X))))`. This is the GROUP LIBRARY + hero stats. It is NOT the full member-set of grouped entries ("everyone who shares a group") — that was the original bug. **Option A (legacy backfill, no data migration):** legacy un-grouped entries (`groupId IS NULL`, logged before the groups feature) surface in EVERY group their author is an ACTIVE member of, so pre-groups shows don't vanish. `getActiveGroupMemberIds` is `status='active'` only; empty member list → filter falls back to `eq(groupId,X)` (avoids invalid empty `inArray`). `/stats` uses the same filter so hero stats match the library.
- `userId=U` branch (member profile): SELF (`U===caller`) returns ALL own entries across every group (incl. unassigned). For OTHERS it is scoped to `sharedActiveGroupIds(caller, U)` — `and(eq(userId,U), inArray(groupId, sharedIds))` — so you only see that member's entries from groups you BOTH currently actively belong to; non-shared-group AND unassigned entries are excluded; empty shared set → 403. (Privacy tightening: it is NOT cross-group anymore.)
- default (no param): caller-only (`eq(entries.userId, callerId)`), across all the caller's groups.
- `unassigned=true`: caller-owned `isNull(groupId)` — legacy/group-less entries.
- `GET /entries/:id` (direct fetch): self → allow; else for a GROUP-tagged entry allow iff `isMember(entry.groupId, caller)` (mirrors the group library, so removed members' group-tagged entries stay openable by that group); for an UNASSIGNED entry (`groupId IS NULL`) of another user, allow iff `usersShareGroup(caller, entry.userId)` (Option A — co-member can open a legacy card visible in their shared group library), else 404.

**Why:** users belong to multiple groups; an entry belongs to the one group it was logged in, not all of them.

**How to apply:**
- POST persists `groupId` (active group, or null); if a `groupId` is given, check `isMember` BEFORE insert (403 leaves no side effect).
- PATCH allows reassigning `groupId` for triage; check ownership then `isMember` of the target group before the update.
- `groupId` is kept NULLABLE (NOT NULL push fails on populated tables); NULL = unassigned, surfaced via the `/unassigned` triage page + Home banner.
- Out of scope (still member-set scoped): audiences, watchlist alsoEngagedBy, comments, reactions, AND the activity feed + weekly digest.

**Activity feed/digest scope by ACTOR membership, NOT entry.groupId.** `/activity/feed` and `/activity/digest` filter every source (entries, ratings, comments, watchlist, audiences, spice) by `userId ∈ resolveMemberIds(group)` — the actor being a current group member — never by the rated/authored entry's `groupId`. This means a multi-group member's action on a Group-A entry can appear in Group-B's feed if they're also in B. This is INTENTIONAL and uniform across ALL feed sources (it's "what your group-mates have been up to"), NOT a privacy regression — do not "fix" rating items to filter by entry.groupId in isolation, that would make them inconsistent with every sibling source. (An architect review flagged this as a leak; it is by-design.) Per-entry `averageRating` (in `enrichEntries`/`/stats`) IS naturally group-scoped because only members of an entry's group may rate it.
