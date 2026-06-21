---
name: Group-scoped write authorization ordering
description: Membership/authorization checks must run BEFORE the DB mutation in group-scoped write endpoints, not after.
---

In the per-show poll endpoints (approvals, spice), the group-membership check (`resolveMemberIds`, which returns null → 403 for a non-member `groupId`) must run **before** the insert/update/delete, then the mutation, then the summary. Originally these did the mutation first and the 403 check after — so a non-member `groupId` still mutated the caller's own row even though the response was 403, silently violating the documented "non-member groupId → 403 with no side effects" contract.

**Why:** A 403 response that still changed state is a broken access-control pattern. Even though the mutated row is caller-owned, the contract promises no side effects for an unauthorized group scope, and divergent behavior between the two parallel features is a maintenance trap.

**How to apply:** For any new group-scoped write that mirrors this pattern, order it: parse/validate → resolve+check membership (early 403) → mutate → summarize → respond. Keep approvals and spice in lockstep — they are intentionally identical except spice has no "solo" answer.
