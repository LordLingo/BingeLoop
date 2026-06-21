---
name: Canonical category contract
description: Why the entry category field must be a constrained control, not free text
---

# Category is a server-enforced canonical list

The API server validates `category` against a hardcoded `CATEGORIES` array (in `artifacts/api-server/src/routes/entries.ts`) on both `POST /entries` and `PATCH /entries/:id`, returning 400 "Invalid category" on any mismatch. The list is exposed via `GET /categories` (`useListCategories()`).

**Why:** A free-text category input shipped once and every create/edit failed with 400 because typed values (casing, custom genres, even the placeholder example) never matched the canonical list exactly. Symptom in logs: fast (~3-9ms) 400 on POST /entries, before the Clerk getUser call.

**How to apply:** Any UI control for `category` must be a Select/dropdown populated from `useListCategories()`, never a text input. If categories are ever added, edit the `CATEGORIES` array server-side — the dropdown updates automatically.
