---
name: API server testing setup
description: How integration tests for the Express API are wired (real DB + mocked Clerk).
---

# API server integration tests

The api-server has vitest integration tests (`artifacts/api-server/src/__tests__/`) that
exercise the real Express router and real Postgres DB. Run with
`pnpm --filter @workspace/api-server run test`.

**How auth is faked:** `setup.ts` does `vi.mock("@clerk/express")` so `getAuth` reads the
acting user from the `x-test-user-id` request header, and `clerkClient.users.getUser`
returns a deterministic profile. Tests build a minimal app (`testApp.ts`) that mounts the
real `routes` router — they do NOT import `app.ts` (avoids Clerk network middleware).

**Why a real DB, not a mock:** routes call `db.select().from().where()` directly with the
drizzle query builder; mocking that is far more brittle than seeding/cleaning real rows.
Tests use a unique per-run id prefix for user ids and clean up everything in `afterAll`
(and call `pool.end()`).

**Gotcha — response shapes strip fields:** route handlers `.parse()` responses through the
Orval/zod schemas, so fields not in the OpenAPI schema are dropped from the body. Notably
the `Entry` response has NO `userId` — assert on `addedBy` (the attribution snapshot)
instead. Seed `addedBy` equal to the user id to make visibility assertions easy.

**Config note:** `vitest.config.ts` sets `server.deps.inline: [/@workspace\//]` because the
workspace packages (e.g. `@workspace/db`) ship TS source and must be transformed, and
`fileParallelism: false` since all test files share one database.
