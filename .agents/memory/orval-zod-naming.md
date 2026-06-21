---
name: Orval zod response schema naming
description: Which symbol to import from @workspace/api-zod for runtime validation
---

# Orval-generated zod export naming

For a server response, the runtime zod schema in `@workspace/api-zod` is named after the **operationId** + `Response` (e.g. operationId `checkIn` → `CheckInResponse`), not after the OpenAPI component schema name.

The component schema name (e.g. `CheckInResult`) is generated only as a TypeScript **type/interface**, not a runtime value. Importing it and calling `.parse()` fails with TS2693 ("only refers to a type, but is being used as a value").

**Why:** Orval derives the zod validator name from the operation, while the type name mirrors the OpenAPI schema. They differ whenever an operation's response `$ref`s a named schema.

**How to apply:** In server route handlers, import `<OperationId>Response` from `@workspace/api-zod` for `.parse()`. If unsure of the exact export name, grep `lib/api-zod/src/generated/api.ts` for the operation.
