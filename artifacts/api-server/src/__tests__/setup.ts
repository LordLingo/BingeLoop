import { vi } from "vitest";

// Replace Clerk with a lightweight test double. `getAuth` reads the signed-in
// user from the `x-test-user-id` request header so each request can act as a
// different user, and `clerkClient.users.getUser` returns a deterministic
// profile used for the `addedBy` display-name snapshot.
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers?: Record<string, unknown> }) => ({
    userId: (req?.headers?.["x-test-user-id"] as string | undefined) ?? null,
  }),
  clerkClient: {
    users: {
      getUser: async (userId: string) => ({
        id: userId,
        firstName: userId,
        lastName: null,
        username: userId,
        primaryEmailAddress: { emailAddress: `${userId}@test.dev` },
      }),
    },
  },
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
}));
