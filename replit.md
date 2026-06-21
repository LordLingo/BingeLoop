# Watchlist

A mobile-first web app where users log TV shows and movies, rate them 1–5 stars, leave a comment, and tag a category (Drama, Comedy, Thriller, etc.).

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
- DB schema: `lib/db/src/schema/entries.ts`
- API routes: `artifacts/api-server/src/routes/entries.ts`
- Generated hooks: `@workspace/api-client-react`; generated Zod: `@workspace/api-zod`

## Architecture decisions

- Categories are a server-defined canonical list (`CATEGORIES` in `entries.ts`), exposed via `GET /categories` and enforced on create/update. To add a category, edit that array.
- On create, `comment` is an optional string (null is rejected); on update, `comment` is nullable so it can be cleared.
- `/stats` aggregates in the handler (totals, avg rating, per-category counts) rather than via SQL aggregation, for simplicity at this scale.
- Auth is Replit-managed Clerk (email/password, cookie-based on web). `requireAuth` is mounted on the entries router, so `/entries`, `/stats`, `/categories` all require a session; `/healthz` stays public.
- Single shared group: every signed-in user sees ALL entries (no per-user filtering). Each entry stores `userId` (Clerk id) and `addedBy` (display-name snapshot, resolved from Clerk on create) for "added by" attribution. If group scoping is ever needed, add a `groupId` and filter list/stats by it.

## Product

Users browse their watch library with category/media-type filters and sorting, see summary stats (total logged, average rating, movie/TV split, category breakdown), and add/edit/delete entries — each with a title, movie/TV type, 1–5 star rating, category, and optional comment.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
