import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/__tests__/setup.ts"],
    // Workspace packages (e.g. @workspace/db) ship TypeScript source, so they
    // must be transformed rather than externalized.
    server: { deps: { inline: [/@workspace\//] } },
    // Tests share a single Postgres database; run files serially to avoid
    // cross-file interference.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
