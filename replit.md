# BingeLoop

A mobile-first web app (brand name: BingeLoop) where users log TV shows and movies, rate them 1–5 stars, leave a comment, and tag a category (Drama, Comedy, Thriller, etc.).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/watchlist/` (React + Vite, served at `/`)
- API contract (source of truth): `lib/api-spec/openapi.yaml`
- DB schema: `lib/db/src/schema/`
- API routes: `artifacts/api-server/src/routes/`; shared auth in `middlewares/requireAuth.ts`; membership helpers in `lib/groups.ts`
- Generated hooks: `@workspace/api-client-react`; generated Zod: `@workspace/api-zod`

## Product

Users create and name their own groups, invite others by link, belong to multiple groups, and switch the active group (new accounts with no groups land on an Onboarding screen to create their first). The library, hero stats, and "also engaged by" attribution are all scoped to the active group's members. Within that scope users browse their watch library with category/media-type filters and sorting, see summary stats (total logged, average rating, movie/TV split, category breakdown), and add/edit/delete entries — each with a title, movie/TV type, 1–5 star rating, category, and optional comment. Entries, watchlist saves, and approvals remain personal to each user; you only see another member's data when you share a group with them.

## Documentation

Detailed notes are split into focused docs under [`docs/`](./docs):

- [`docs/architecture.md`](./docs/architecture.md) — core decisions: entries/categories/stats/auth, groups & membership (incl. soft-removal), privacy/data-scoping, and the non-member `groupId` 403 contract.
- [`docs/features.md`](./docs/features.md) — per-feature detail: watchlist, approvals, spicy flag, comments, activity feed, new-activity badge, Top Four, lists, invites, TMDB search, emoji reactions, weekly digest.
- [`docs/design.md`](./docs/design.md) — the light "cinematic editorial" theme, fonts, and the navy `.poster-card` token re-scoping.
- [`docs/roadmap.md`](./docs/roadmap.md) — parked ideas not yet built (incl. deferred email/push digest delivery).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- API auth depends on router MOUNT ORDER. `entriesRouter` calls `router.use(requireAuth)` with no path, and every sub-router in `routes/index.ts` is mounted via `router.use(...)` with no path prefix — so that global auth runs for EVERY request that reaches `entriesRouter` and 401s anything still unhandled. Any PUBLIC route (e.g. `GET /invites/:token`) MUST be mounted before `entriesRouter`; `healthRouter` and `invitesRouter` are intentionally mounted first. Do not reorder routers without preserving this.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
