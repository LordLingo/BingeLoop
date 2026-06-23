---
name: Audience poll is multi-select, spice is single-select
description: The "Who Should Watch?" audience poll and the spice poll share a scoping contract but NOT an answer shape — do not mirror them blindly.
---

The "Who Should Watch?" poll (`show_audiences`, routes `/audiences`) is MULTI-SELECT: a member picks any subset of the canonical `Audience` values (`girls`,`guys`,`couples`,`solo`), stored as a `text[]` column. The spice poll (`show_spice`) is SINGLE-answer, a 3-level maturity rating: `mild`/`mature`/`adult` (1/2/3 peppers, shown as Mild / 17+ / Adults Only). It was a binary `yes`/`no` before — the column is plain `text` (no DB enum), so legacy `yes`/`no` rows still exist in prod.

**Why:** Older docs described the spice flag as a "DIRECT MIRROR" of the (then single-answer) approval poll and said to "edit both in lockstep." That stopped being true when the approval poll was replaced by the multi-select audience poll. They now share only the group-scoping contract (`resolveMemberIds` → `[callerId]` no-group / all member ids if member / `null`→403, checked before any mutation), not the answer shape.

**How to apply:** When extending either poll, do NOT assume the other has the same write/aggregation semantics. Audience writes upsert a full array (empty array → 400), and the tally aggregates in JS counting each picked option per member, so the four per-option counts can sum past the member count. For spice, any code that reads the raw `spicy` column and feeds a zod-validated response (tallies AND the `/activity/feed` mapping) MUST guard with an `isSpicyValue` check — legacy `yes`/`no` values are not in the enum and will 500 the response parse if passed through. Treat unknown values as ignored/null.
