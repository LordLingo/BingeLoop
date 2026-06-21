---
name: API router auth ordering
description: Public API routes must be mounted before entriesRouter, which applies global requireAuth with no path.
---

In `artifacts/api-server`, `entriesRouter` does `router.use(requireAuth)` with NO path, and `routes/index.ts` mounts every sub-router with `router.use(<router>)` (no path prefix on `/api`). Express runs each mounted router's middleware stack in order for any request that reaches it, so that global `requireAuth` 401s ANY request not already handled by an earlier router.

**Rule:** any public (no-auth) endpoint must be mounted BEFORE `entriesRouter`. `healthRouter` and `invitesRouter` are mounted first for this reason. Routers whose protected endpoints use PER-ROUTE `requireAuth` (like invites) can safely sit before entries because they don't block unrelated paths.

**Why:** mounting a public route (e.g. `GET /invites/:token`) after `entriesRouter` made it return `{"error":"Unauthorized"}` even though the route itself had no auth. Reordering fixed it.

**How to apply:** when adding any public endpoint, place its router above `entriesRouter` in `routes/index.ts`; better long-term fix is to make entries use per-route auth instead of router-global.
