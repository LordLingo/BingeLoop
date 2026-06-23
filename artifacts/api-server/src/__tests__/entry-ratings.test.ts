import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  groupsTable,
  groupMembersTable,
  entriesTable,
  entryRatingsTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";
import request from "supertest";

const app = makeTestApp();

const RUN = `er${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;
const BOB = `${RUN}_bob`;
const CAROL = `${RUN}_carol`;
const ALL_USERS = [ALICE, BOB, CAROL];

// group1 = { alice (owner), bob }; group2 = { carol } (shares nothing with the
// others). sortGroup / statsGroup hold isolated fixtures for the sort + stats
// assertions so they don't interfere with the mutation flow.
let group1Id: number;
let group2Id: number;
let sortGroupId: number;
let statsGroupId: number;

// Alice-authored group1 entry with NO initial rating — the subject of the
// set/change/clear flow.
let flowEntryId: number;
// A Bob-authored entry used to prove "own" stats average the caller's own
// rating, not someone else's rating of the same show.
let bobOwnEntryId: number;

function as(userId: string) {
  return { "x-test-user-id": userId };
}

async function insertEntry(values: {
  title: string;
  mediaType: "movie" | "tv";
  category: string;
  userId: string;
  groupId: number;
}): Promise<number> {
  const [row] = await db
    .insert(entriesTable)
    .values({ ...values, addedBy: values.userId })
    .returning();
  return row.id;
}

beforeAll(async () => {
  const [g1] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} One`, ownerId: ALICE })
    .returning();
  const [g2] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} Two`, ownerId: CAROL })
    .returning();
  const [gSort] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} Sort`, ownerId: ALICE })
    .returning();
  const [gStats] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} Stats`, ownerId: ALICE })
    .returning();
  group1Id = g1.id;
  group2Id = g2.id;
  sortGroupId = gSort.id;
  statsGroupId = gStats.id;

  await db.insert(groupMembersTable).values([
    { groupId: group1Id, userId: ALICE, displayName: ALICE, role: "owner" },
    { groupId: group1Id, userId: BOB, displayName: BOB, role: "member" },
    { groupId: group2Id, userId: CAROL, displayName: CAROL, role: "owner" },
    { groupId: sortGroupId, userId: ALICE, displayName: ALICE, role: "owner" },
    { groupId: statsGroupId, userId: ALICE, displayName: ALICE, role: "owner" },
    { groupId: statsGroupId, userId: BOB, displayName: BOB, role: "member" },
  ]);

  flowEntryId = await insertEntry({
    title: "Flow",
    mediaType: "movie",
    category: "Drama",
    userId: ALICE,
    groupId: group1Id,
  });

  // Sort fixtures: two rated (5 and 2) + one unrated, to assert nulls-last.
  const high = await insertEntry({
    title: "Sort High",
    mediaType: "movie",
    category: "Drama",
    userId: ALICE,
    groupId: sortGroupId,
  });
  const mid = await insertEntry({
    title: "Sort Mid",
    mediaType: "movie",
    category: "Drama",
    userId: ALICE,
    groupId: sortGroupId,
  });
  await insertEntry({
    title: "Sort None",
    mediaType: "movie",
    category: "Drama",
    userId: ALICE,
    groupId: sortGroupId,
  });
  await db.insert(entryRatingsTable).values([
    { entryId: high, userId: ALICE, rating: 5 },
    { entryId: mid, userId: ALICE, rating: 2 },
  ]);

  // Stats fixtures (group scope averages EVERY member's ratings; unrated shows
  // are ignored). SA: 4+2, SB: 5, SC: unrated, SD (Bob's): 1 (Alice) + 5 (Bob).
  const sa = await insertEntry({
    title: "Stats A",
    mediaType: "movie",
    category: "Drama",
    userId: ALICE,
    groupId: statsGroupId,
  });
  const sb = await insertEntry({
    title: "Stats B",
    mediaType: "movie",
    category: "Drama",
    userId: ALICE,
    groupId: statsGroupId,
  });
  await insertEntry({
    title: "Stats C",
    mediaType: "tv",
    category: "Drama",
    userId: ALICE,
    groupId: statsGroupId,
  });
  bobOwnEntryId = await insertEntry({
    title: "Stats D",
    mediaType: "tv",
    category: "Drama",
    userId: BOB,
    groupId: statsGroupId,
  });
  await db.insert(entryRatingsTable).values([
    { entryId: sa, userId: ALICE, rating: 4 },
    { entryId: sa, userId: BOB, rating: 2 },
    { entryId: sb, userId: ALICE, rating: 5 },
    { entryId: bobOwnEntryId, userId: ALICE, rating: 1 },
    { entryId: bobOwnEntryId, userId: BOB, rating: 5 },
  ]);
});

afterAll(async () => {
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

describe("POST /entries — optional initial rating", () => {
  it("creates an unrated entry when no rating is supplied", async () => {
    const res = await request(app)
      .post("/api/entries")
      .set(as(ALICE))
      .send({
        title: "No Rating",
        mediaType: "movie",
        category: "Drama",
        groupId: group1Id,
      });
    expect(res.status).toBe(201);
    expect(res.body.averageRating).toBeNull();
    expect(res.body.ratingCount).toBe(0);
    expect(res.body.myRating).toBeNull();
  });

  it("records the creator's personal rating when supplied", async () => {
    const res = await request(app)
      .post("/api/entries")
      .set(as(ALICE))
      .send({
        title: "With Rating",
        mediaType: "movie",
        category: "Drama",
        groupId: group1Id,
        rating: 4,
      });
    expect(res.status).toBe(201);
    expect(res.body.averageRating).toBe(4);
    expect(res.body.ratingCount).toBe(1);
    expect(res.body.myRating).toBe(4);
  });
});

describe("PUT/DELETE /entries/:id/rating — per-member ratings", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .put(`/api/entries/${flowEntryId}/rating`)
      .send({ rating: 3 });
    expect(res.status).toBe(401);
  });

  it("validates the rating range", async () => {
    const tooHigh = await request(app)
      .put(`/api/entries/${flowEntryId}/rating`)
      .set(as(ALICE))
      .send({ rating: 6 });
    expect(tooHigh.status).toBe(400);

    const tooLow = await request(app)
      .put(`/api/entries/${flowEntryId}/rating`)
      .set(as(ALICE))
      .send({ rating: 0 });
    expect(tooLow.status).toBe(400);
  });

  it("404s a non-existent entry", async () => {
    const res = await request(app)
      .put(`/api/entries/999999999/rating`)
      .set(as(ALICE))
      .send({ rating: 3 });
    expect(res.status).toBe(404);
  });

  it("lets the author set their own rating", async () => {
    const res = await request(app)
      .put(`/api/entries/${flowEntryId}/rating`)
      .set(as(ALICE))
      .send({ rating: 5 });
    expect(res.status).toBe(200);
    expect(res.body.averageRating).toBe(5);
    expect(res.body.ratingCount).toBe(1);
    expect(res.body.myRating).toBe(5);
  });

  it("lets another member add their own rating (averaged together)", async () => {
    const res = await request(app)
      .put(`/api/entries/${flowEntryId}/rating`)
      .set(as(BOB))
      .send({ rating: 3 });
    expect(res.status).toBe(200);
    expect(res.body.averageRating).toBe(4); // (5 + 3) / 2
    expect(res.body.ratingCount).toBe(2);
    expect(res.body.myRating).toBe(3); // Bob's own
  });

  it("changes a member's existing rating without adding a new row", async () => {
    const res = await request(app)
      .put(`/api/entries/${flowEntryId}/rating`)
      .set(as(BOB))
      .send({ rating: 1 });
    expect(res.status).toBe(200);
    expect(res.body.averageRating).toBe(3); // (5 + 1) / 2
    expect(res.body.ratingCount).toBe(2);
    expect(res.body.myRating).toBe(1);
  });

  it("clears only the caller's own rating", async () => {
    const res = await request(app)
      .delete(`/api/entries/${flowEntryId}/rating`)
      .set(as(BOB));
    expect(res.status).toBe(200);
    expect(res.body.averageRating).toBe(5); // Alice's 5 remains
    expect(res.body.ratingCount).toBe(1);
    expect(res.body.myRating).toBeNull(); // Bob's gone
  });

  it("forbids a non-member and leaves no side effect", async () => {
    const res = await request(app)
      .put(`/api/entries/${flowEntryId}/rating`)
      .set(as(CAROL))
      .send({ rating: 2 });
    expect(res.status).toBe(403);

    // The rejected write must not have touched the aggregate.
    const after = await request(app)
      .get(`/api/entries/${flowEntryId}`)
      .set(as(ALICE));
    expect(after.status).toBe(200);
    expect(after.body.averageRating).toBe(5);
    expect(after.body.ratingCount).toBe(1);
  });
});

describe("GET /entries — rating sort keeps unrated last", () => {
  it("sorts highest average first, nulls last", async () => {
    const res = await request(app)
      .get("/api/entries")
      .query({ groupId: sortGroupId, sort: "rating_high" })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    const titles = res.body.map((e: { title: string }) => e.title);
    expect(titles).toEqual(["Sort High", "Sort Mid", "Sort None"]);
  });

  it("sorts lowest average first, still nulls last", async () => {
    const res = await request(app)
      .get("/api/entries")
      .query({ groupId: sortGroupId, sort: "rating_low" })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    const titles = res.body.map((e: { title: string }) => e.title);
    expect(titles).toEqual(["Sort Mid", "Sort High", "Sort None"]);
  });
});

describe("GET /stats — averages come from entry_ratings only", () => {
  it("averages every member's rating in a group scope, ignoring unrated", async () => {
    const res = await request(app)
      .get("/api/stats")
      .query({ groupId: statsGroupId })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.movieCount).toBe(2);
    expect(res.body.tvCount).toBe(2);
    // ratings = [4, 2, 5, 1, 5] over 5 rows = 3.4 (unrated "Stats C" ignored).
    expect(res.body.averageRating).toBe(3.4);
  });

  it("averages only the caller's own ratings in a personal scope", async () => {
    const res = await request(app).get("/api/stats").set(as(BOB));
    expect(res.status).toBe(200);
    // Bob authored only "Stats D"; his own rating there is 5 (not Alice's 1).
    expect(res.body.total).toBe(1);
    expect(res.body.averageRating).toBe(5);
  });
});
