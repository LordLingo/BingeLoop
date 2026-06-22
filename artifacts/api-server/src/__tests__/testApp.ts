import express, { type Express } from "express";
import router from "../routes";

// Minimal app that mounts the real API router (and thus the real auth and
// group-scoping logic) without Clerk's network middleware. Auth is provided by
// the mocked `@clerk/express` from setup.ts, which reads the acting user from
// the `x-test-user-id` header.
export function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // pino-http isn't mounted in tests, so provide a no-op req.log that route
  // handlers can call (e.g. in catch blocks) without crashing.
  app.use((req, _res, next) => {
    (req as unknown as { log: Record<string, () => void> }).log = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    };
    next();
  });
  app.use("/api", router);
  return app;
}
