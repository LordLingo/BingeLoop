import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  groupsTable,
  groupMembersTable,
  entriesTable,
  entryRatingsTable,
  watchlistItemsTable,
  showCommentsTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";
import request from "supertest";

const app = makeTestApp();

const RUN = `d${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;
const BOB = `${RUN}_bob`;
const CAROL = `${RUN}_carol`;
const ALL_USERS = [ALICE, BOB, CAROL];

// Group 1 = { alice, bob }; Group 2 = { carol }.
let group1Id: number;
let group2Id: number;

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
    { groupId: group1Id, userId: ALICE, displayName: ALICE, role: "owner" },
    { groupId: group1Id, userId: BOB, displayName: BOB, role: "member" },
    { groupId: group2Id, userId: CAROL, displayName: CAROL, role: "owner" },
  ]);

  // Alice logs two entries (the 5★ is the week's top pick); Bob logs one.
  const ratedEntries = await db
    .insert(entriesTable)
    .values([
      {
        userId: ALICE,
        title: "Interstellar",
        mediaType: "movie",
        category: "Drama",
        addedBy: ALICE,
      },
      {
        userId: ALICE,
        title: "Tenet",
        mediaType: "movie",
        category: "Thriller",
        addedBy: ALICE,
      },
      {
        userId: BOB,
        title: "The Bear",
        mediaType: "tv",
        category: "Drama",
        addedBy: BOB,
      },
    ])
    .returning();
  const idOf = (title: string) =>
    ratedEntries.find((e) => e.title === title)!.id;

  // Per-member ratings now live in entry_ratings; the digest counts a rating as
  // any member setting their own score this week.
  await db.insert(entryRatingsTable).values([
    { entryId: idOf("Interstellar"), userId: ALICE, rating: 5 },
    { entryId: idOf("Tenet"), userId: ALICE, rating: 3 },
    { entryId: idOf("The Bear"), userId: BOB, rating: 4 },
  ]);

  // Alice saves a show and comments → most-active should be Alice (4 actions).
  await db.insert(watchlistItemsTable).values({
    userId: ALICE,
    title: "Dune",
    titleKey: "dune",
    mediaType: "movie",
    addedBy: ALICE,
  });
  await db.insert(showCommentsTable).values({
    userId: ALICE,
    authorName: ALICE,
    titleKey: "interstellar",
    mediaType: "movie",
    body: "Masterpiece.",
  });
});

afterAll(async () => {
  await db
    .delete(showCommentsTable)
    .where(inArray(showCommentsTable.userId, ALL_USERS));
  await db
    .delete(watchlistItemsTable)
    .where(inArray(watchlistItemsTable.userId, ALL_USERS));
  await db
    .delete(entryRatingsTable)
    .where(inArray(entryRatingsTable.userId, ALL_USERS));
  await db.delete(entriesTable).where(inArray(entriesTable.userId, ALL_USERS));
  await db
    .delete(groupMembersTable)
    .where(inArray(groupMembersTable.userId, ALL_USERS));
  await db.delete(groupsTable).where(inArray(groupsTable.ownerId, ALL_USERS));
  await pool.end();
});

describe("GET /activity/digest", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .get("/api/activity/digest")
      .query({ groupId: group1Id });
    expect(res.status).toBe(401);
  });

  it("summarizes the group's week with top pick and most-active member", async () => {
    const res = await request(app)
      .get("/api/activity/digest")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.newRatings).toBe(3);
    expect(res.body.newComments).toBe(1);
    expect(res.body.newSaves).toBe(1);
    expect(res.body.topShow).toMatchObject({
      title: "Interstellar",
      rating: 5,
      addedBy: ALICE,
    });
    expect(res.body.mostActive).toMatchObject({ name: ALICE, count: 4 });
  });

  it("scopes to caller-only when no group is passed", async () => {
    const res = await request(app)
      .get("/api/activity/digest")
      .set(as(BOB));
    expect(res.status).toBe(200);
    // Bob alone has only his single rating that week.
    expect(res.body.newRatings).toBe(1);
    expect(res.body.newComments).toBe(0);
    expect(res.body.newSaves).toBe(0);
    expect(res.body.mostActive).toMatchObject({ name: BOB, count: 1 });
  });

  it("forbids a group the caller does not belong to", async () => {
    const res = await request(app)
      .get("/api/activity/digest")
      .query({ groupId: group1Id })
      .set(as(CAROL));
    expect(res.status).toBe(403);
  });
});
