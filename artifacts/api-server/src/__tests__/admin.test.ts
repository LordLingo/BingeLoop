import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  groupsTable,
  entriesTable,
  userProfilesTable,
  userActivityTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";
import request from "supertest";

const app = makeTestApp();

const RUN = `r${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const OWNER = `${RUN}_owner`;
const MEMBER = `${RUN}_member`;

// The test Clerk mock gives every user the email `<userId>@test.dev`, so making
// OWNER the admin is just a matter of pointing ADMIN_EMAIL at that address.
const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function as(userId: string) {
  return { "x-test-user-id": userId };
}

let groupId: number;

beforeAll(async () => {
  process.env.ADMIN_EMAIL = `${OWNER}@test.dev`;

  await db.insert(userProfilesTable).values([
    { userId: OWNER, displayName: `${RUN} Owner` },
    { userId: MEMBER, displayName: `${RUN} Member` },
  ]);
  await db
    .insert(userActivityTable)
    .values({ userId: MEMBER, lastSeenAt: new Date() });

  const [g] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} Group`, ownerId: OWNER })
    .returning();
  groupId = g.id;

  await db.insert(entriesTable).values([
    {
      title: `${RUN} A`,
      mediaType: "movie",
      rating: 5,
      category: "Drama",
      userId: OWNER,
      addedBy: `${RUN} Owner`,
      groupId,
    },
    {
      title: `${RUN} B`,
      mediaType: "tv",
      rating: 4,
      category: "Comedy",
      userId: MEMBER,
      addedBy: `${RUN} Member`,
      groupId,
    },
  ]);
});

afterAll(async () => {
  if (ORIGINAL_ADMIN_EMAIL === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;

  await db.delete(entriesTable).where(inArray(entriesTable.groupId, [groupId]));
  await db.delete(groupsTable).where(inArray(groupsTable.id, [groupId]));
  await db
    .delete(userActivityTable)
    .where(inArray(userActivityTable.userId, [OWNER, MEMBER]));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.userId, [OWNER, MEMBER]));
  await pool.end();
});

describe("admin gate", () => {
  it("403s a non-admin user", async () => {
    const res = await request(app).get("/api/admin/stats").set(as(MEMBER));
    expect(res.status).toBe(403);
  });

  it("401s an unauthenticated request", async () => {
    const res = await request(app).get("/api/admin/stats");
    expect(res.status).toBe(401);
  });

  it("403s everyone when ADMIN_EMAIL is unset", async () => {
    const saved = process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_EMAIL;
    const res = await request(app).get("/api/admin/stats").set(as(OWNER));
    process.env.ADMIN_EMAIL = saved;
    expect(res.status).toBe(403);
  });

  it("returns aggregate stats for the admin", async () => {
    const res = await request(app).get("/api/admin/stats").set(as(OWNER));
    expect(res.status).toBe(200);

    const body = res.body;
    // Counts are app-wide, so assert our created data is reflected (>=).
    expect(body.totalUsers).toBeGreaterThanOrEqual(2);
    expect(body.newUsersLast7Days).toBeGreaterThanOrEqual(2);
    expect(body.activeUsersLast7Days).toBeGreaterThanOrEqual(1);
    expect(body.totalGroups).toBeGreaterThanOrEqual(1);
    expect(body.totalEntries).toBeGreaterThanOrEqual(2);

    // Exactly 30 zero-filled days, oldest first, ending today.
    expect(Array.isArray(body.signupsByDay)).toBe(true);
    expect(body.signupsByDay).toHaveLength(30);
    const today = new Date().toISOString().slice(0, 10);
    const last = body.signupsByDay[body.signupsByDay.length - 1];
    expect(last.date).toBe(today);
    expect(last.count).toBeGreaterThanOrEqual(2);
  });
});

describe("profile isAdmin flag", () => {
  it("is true for the admin", async () => {
    const res = await request(app).get("/api/profile").set(as(OWNER));
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
  });

  it("is false for a non-admin", async () => {
    const res = await request(app).get("/api/profile").set(as(MEMBER));
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(false);
  });
});
