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
  app.use("/api", router);
  return app;
}
