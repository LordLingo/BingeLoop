---
name: Orval coerce.string() query params
description: Why a required string query param won't 400 on a missing value, and how to test it.
---

Orval generates string query params as `zod.coerce.string().min(1)`. `zod.coerce.string()`
runs `String(value)`, so a **missing** param (`undefined`) coerces to the literal string
`"undefined"` (length 9), which PASSES `min(1)`. So a "required" string query param does NOT
produce a 400 when omitted — the handler runs with `query === "undefined"`.

**Why:** caught while testing `GET /tmdb/search` — the "missing query → 400" assumption was
wrong; the handler instead reached out to TMDB with `query=undefined`.

**How to apply:** to exercise the `min(1)` validation in a test, send an EMPTY value
(`?query=`) — `String("")` stays `""` and fails `min(1)` → 400. If you truly need a missing
required param to 400, add an explicit guard in the handler (coercion won't do it for you).
