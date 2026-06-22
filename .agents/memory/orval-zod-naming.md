---
name: Orval zod response schema naming
description: Which symbol to import from @workspace/api-zod for runtime validation
---

# Orval-generated zod export naming

For a server response, the runtime zod schema in `@workspace/api-zod` is named after the **operationId** + `Response` (e.g. operationId `checkIn` → `CheckInResponse`), not after the OpenAPI component schema name.

The component schema name (e.g. `CheckInResult`) is generated only as a TypeScript **type/interface**, not a runtime value. Importing it and calling `.parse()` fails with TS2693 ("only refers to a type, but is being used as a value").

**Why:** Orval derives the zod validator name from the operation, while the type name mirrors the OpenAPI schema. They differ whenever an operation's response `$ref`s a named schema.

**How to apply:** In server route handlers, import `<OperationId>Response` from `@workspace/api-zod` for `.parse()`. If unsure of the exact export name, grep `lib/api-zod/src/generated/api.ts` for the operation.

## 201 responses get NO generated zod response schema

Orval's zod target only emits a `<OperationId>Response` for **200** responses. An operation whose success is **201** (e.g. a create endpoint) gets `<OperationId>Body` but no `<OperationId>Response`.

**How to apply:** To validate the created resource, reuse a 200-shaped schema of the same object — e.g. `createComment` (201) parses with `ListCommentsResponseItem`; `createEntry` (201) parses with `GetEntryResponse`. For an array-returning list op, the per-item schema is `<OperationId>ResponseItem` (the array is `<OperationId>Response`).
