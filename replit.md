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
- DB schema: `lib/db/src/schema/` (`entries.ts`, `userActivity.ts`, `watchlist.ts`, `approvals.ts`)
- API routes: `artifacts/api-server/src/routes/` (`entries.ts`, `activity.ts`, `watchlist.ts`, `approvals.ts`); shared auth in `middlewares/requireAuth.ts`
- Generated hooks: `@workspace/api-client-react`; generated Zod: `@workspace/api-zod`

## Architecture decisions

- Categories are a server-defined canonical list (`CATEGORIES` in `entries.ts`), exposed via `GET /categories` and enforced on create/update. To add a category, edit that array.
- On create, `comment` is an optional string (null is rejected); on update, `comment` is nullable so it can be cleared.
- `/stats` aggregates in the handler (totals, avg rating, per-category counts) rather than via SQL aggregation, for simplicity at this scale.
- Auth is Replit-managed Clerk (email/password, cookie-based on web). `requireAuth` is mounted on the entries router, so `/entries`, `/stats`, `/categories` all require a session; `/healthz` stays public.
- Single shared group: every signed-in user sees ALL entries (no per-user filtering). Each entry stores `userId` (Clerk id) and `addedBy` (display-name snapshot, resolved from Clerk on create) for "added by" attribution. If group scoping is ever needed, add a `groupId` and filter list/stats by it.
- Personal watchlist: `watchlist_items` table (per-user saved shows) with `unique(userId, titleKey, mediaType)`. A "show" has no canonical entity — the same show across users is matched by `titleKey` (normalized `lower(trim(title))`) + `mediaType`. `GET /watchlist` returns the caller's saved items each annotated with `alsoEngagedBy`: display names of OTHER users who have rated (have an `entries` row) OR saved that same show, deduped by userId across both sources and caller-excluded. `POST /watchlist` is an idempotent upsert; `DELETE /watchlist/:id` is ownership-scoped (id + userId). Save/Saved toggle lives on each library card; `/watchlist` is the personal page.
- Wife-approved poll: `show_approvals` table (per-user answer per show) with `unique(userId, titleKey, mediaType)` and `approval` in (`yes`,`no`,`solo`). Same "same-show" identity as watchlist (`titleKey` = normalized `lower(trim(title))` + `mediaType`). `GET /approvals` groups counts across ALL users by `(titleKey, mediaType, approval)` and overlays the caller's own answer as `myApproval`. `PUT /approvals` upserts the caller's answer (idempotent); `DELETE /approvals?title=&mediaType=` clears it (ownership-scoped on all three columns). Both write endpoints return the fresh `ShowApproval` summary. Interactive `ApprovalControl` (tap an option to set, tap again to clear) lives on the view-entry page; read-only `ApprovalSummary` (e.g. "3 Yes / 1 No") shows on library cards and the watchlist page.
- New-activity badge: `user_activity` table stores per-user `lastSeenAt`. `POST /activity/check-in` reads the prior `lastSeenAt`, counts entries created since then by OTHER users (excludes the caller's own), updates `lastSeenAt` to now, and returns `{ newCount, since }`. The web client calls it once on library mount and shows a dismissible badge when `newCount > 0`. First visit returns 0 (no prior timestamp).
- Invite links: `invites` table (one per user, `unique(createdBy)`, high-entropy random `token` via `randomBytes(16).base64url`) + `invite_acceptances` (`unique(inviteId, userId)`). `POST /invites` (auth) is create-or-get for the caller's single reusable invite; `GET /invites/:token` is PUBLIC (used by the landing page to show the inviter's name before sign-up) and returns `{ token, inviterName, valid }` (valid=false for unknown tokens); `POST /invites/:token/accept` (auth) is an idempotent acceptance (self-accept is a no-op with `joined=false`). Because we're a single shared group, "joining" is automatic on sign-up — acceptance only records attribution and is the hook where real group membership will live later. Web flow: `InviteDialog` (header) generates a copyable link; `/invite/:token` stores the token in `localStorage` and shows sign-up/sign-in CTAs; a global `InviteAccepter` (reactive on `useUser` + location) calls accept once a pending token + signed-in user coincide, covering both the post-sign-up redirect and an already-signed-in user opening a link.

## Product

Users browse their watch library with category/media-type filters and sorting, see summary stats (total logged, average rating, movie/TV split, category breakdown), and add/edit/delete entries — each with a title, movie/TV type, 1–5 star rating, category, and optional comment. Users can also save shows to a personal watchlist and see which other group members have rated or saved the same show.

## Design

- Cinematic "Hollywood" theme: near-black charcoal background with a subtle gold top vignette, warm gold accent (`#E8B500` ≈ `hsl(46 100% 45%)`) used as `--primary`/`--accent`/`--ring` for CTAs, the logo, active states, and the gold star ratings.
- Fonts (loaded in `index.html` + `index.css`): `Bebas Neue` as the display font (`--font-serif`, used for all headings/logo via the base `h1–h6` rule — set in uppercase with wide tracking for a movie-poster feel); `Oswald` as body (`--font-sans`).
- Theme is dark-only: `:root` and `.dark` tokens are identical and `<html class="dark">` is set so Clerk's shadcn theme renders dark too. Editing the palette means editing both blocks in `index.css`.
- Reusable cinematic utilities in `index.css` `@layer components`: `.poster-card` (deep drop shadow + gold hover ring for show cards) and `.cinematic-panel` (dark top-to-background gradient for page hero sections). Page heroes/headers use dark panels with gold accents — avoid large `bg-primary` fills (gold should stay an accent, not a background).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- API auth depends on router MOUNT ORDER. `entriesRouter` calls `router.use(requireAuth)` with no path, and every sub-router in `routes/index.ts` is mounted via `router.use(...)` with no path prefix — so that global auth runs for EVERY request that reaches `entriesRouter` and 401s anything still unhandled. Any PUBLIC route (e.g. `GET /invites/:token`) MUST be mounted before `entriesRouter`; `healthRouter` and `invitesRouter` are intentionally mounted first. Do not reorder routers without preserving this.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
