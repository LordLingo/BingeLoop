import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray, eq } from "drizzle-orm";
import {
  db,
  pool,
  groupsTable,
  groupMembersTable,
  entriesTable,
  showCommentsTable,
  watchlistItemsTable,
  userProfilesTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";
import request from "supertest";

const app = makeTestApp();

const RUN = `p${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;
const BOB = `${RUN}_bob`;
const CAROL = `${RUN}_carol`;
const ALL_USERS = [ALICE, BOB, CAROL];

// Group 1 = { alice, bob }; Group 2 = { carol }.
let group1Id: number;
let group2Id: number;
let aliceEntryId: number;

function as(userId: string) {
  return { "x-test-user-id": userId };
}

beforeAll(async () => {
  const [g1] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} Group One`, ownerId: ALICE })
    .returning();
  const [g2] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} Group Two`, ownerId: CAROL })
    .returning();
  group1Id = g1.id;
  group2Id = g2.id;

  await db.insert(groupMembersTable).values([
    { groupId: group1Id, userId: ALICE, displayName: "Alice", role: "owner" },
    { groupId: group1Id, userId: BOB, displayName: "Bob", role: "member" },
    { groupId: group2Id, userId: CAROL, displayName: "Carol", role: "owner" },
  ]);

  const [entry] = await db
    .insert(entriesTable)
    .values({
      userId: ALICE,
      title: "Interstellar",
      mediaType: "movie",
      rating: 5,
      category: "Drama",
      addedBy: "Alice",
    })
    .returning();
  aliceEntryId = entry.id;

  await db.insert(showCommentsTable).values({
    userId: ALICE,
    titleKey: "interstellar",
    mediaType: "movie",
    authorName: "Alice",
    body: "loved it",
  });

  await db.insert(watchlistItemsTable).values({
    userId: ALICE,
    title: "Dune",
    titleKey: "dune",
    mediaType: "movie",
    addedBy: "Alice",
  });
});

afterAll(async () => {
  await db.delete(watchlistItemsTable).where(inArray(watchlistItemsTable.userId, ALL_USERS));
  await db.delete(showCommentsTable).where(inArray(showCommentsTable.userId, ALL_USERS));
  await db.delete(entriesTable).where(inArray(entriesTable.userId, ALL_USERS));
  await db.delete(groupMembersTable).where(inArray(groupMembersTable.userId, ALL_USERS));
  await db.delete(groupsTable).where(inArray(groupsTable.ownerId, ALL_USERS));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.userId, ALL_USERS));
  await pool.end();
});

describe("GET /profile", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/profile");
    expect(res.status).toBe(401);
  });

  it("returns null when the caller has not set a name", async () => {
    const res = await request(app).get("/api/profile").set(as(BOB));
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBeNull();
  });
});

describe("PUT /profile", () => {
  it("rejects a blank name", async () => {
    const res = await request(app)
      .put("/api/profile")
      .set(as(ALICE))
      .send({ displayName: "   " });
    expect(res.status).toBe(400);
  });

  it("saves the name and fans it out to denormalized snapshots", async () => {
    const res = await request(app)
      .put("/api/profile")
      .set(as(ALICE))
      .send({ displayName: "Alice Cooper" });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Alice Cooper");

    const [member] = await db
      .select({ displayName: groupMembersTable.displayName })
      .from(groupMembersTable)
      .where(eq(groupMembersTable.userId, ALICE))
      .limit(1);
    expect(member.displayName).toBe("Alice Cooper");

    const [entry] = await db
      .select({ addedBy: entriesTable.addedBy })
      .from(entriesTable)
      .where(eq(entriesTable.id, aliceEntryId));
    expect(entry.addedBy).toBe("Alice Cooper");

    const [comment] = await db
      .select({ authorName: showCommentsTable.authorName })
      .from(showCommentsTable)
      .where(eq(showCommentsTable.userId, ALICE))
      .limit(1);
    expect(comment.authorName).toBe("Alice Cooper");

    const [watchlistItem] = await db
      .select({ addedBy: watchlistItemsTable.addedBy })
      .from(watchlistItemsTable)
      .where(eq(watchlistItemsTable.userId, ALICE))
      .limit(1);
    expect(watchlistItem.addedBy).toBe("Alice Cooper");
  });

  it("returns the saved name on a subsequent GET", async () => {
    const res = await request(app).get("/api/profile").set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Alice Cooper");
  });

  it("rejects a name already used by another member of the caller's group (case-insensitive)", async () => {
    const res = await request(app)
      .put("/api/profile")
      .set(as(BOB))
      .send({ displayName: "alice cooper" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("name_taken");

    // Bob's profile must NOT have been written on a conflict.
    const [profile] = await db
      .select({ displayName: userProfilesTable.displayName })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, BOB));
    expect(profile).toBeUndefined();
  });

  it("allows the same name in a DIFFERENT group with no shared members", async () => {
    // Carol is only in group2, which has no overlap with Alice's group1.
    const res = await request(app)
      .put("/api/profile")
      .set(as(CAROL))
      .send({ displayName: "Alice Cooper" });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Alice Cooper");
  });
});
