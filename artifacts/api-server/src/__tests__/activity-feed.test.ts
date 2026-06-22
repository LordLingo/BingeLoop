import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  groupsTable,
  groupMembersTable,
  entriesTable,
  watchlistItemsTable,
  showCommentsTable,
  showApprovalsTable,
  showSpiceTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";
import request from "supertest";

const app = makeTestApp();

const RUN = `af${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;
const BOB = `${RUN}_bob`;
const CAROL = `${RUN}_carol`;
const ALL_USERS = [ALICE, BOB, CAROL];

// Group 1 = { alice, bob }; Group 2 = { carol }.
let group1Id: number;
let group2Id: number;

const MOVIE = "The Matrix";
const MOVIE_KEY = "the matrix";

function as(userId: string) {
  return { "x-test-user-id": userId };
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
  group1Id = g1.id;
  group2Id = g2.id;

  await db.insert(groupMembersTable).values([
    { groupId: group1Id, userId: ALICE, displayName: "Alice", role: "owner" },
    { groupId: group1Id, userId: BOB, displayName: "Bob", role: "member" },
    { groupId: group2Id, userId: CAROL, displayName: "Carol", role: "owner" },
  ]);

  // Alice rates the movie (this also supplies the linkable entry id + title).
  await db.insert(entriesTable).values({
    title: MOVIE,
    mediaType: "movie",
    rating: 5,
    category: "Thriller",
    userId: ALICE,
    addedBy: "Alice",
  });
  // Bob saves it to his watchlist.
  await db.insert(watchlistItemsTable).values({
    userId: BOB,
    addedBy: "Bob",
    title: MOVIE,
    titleKey: MOVIE_KEY,
    mediaType: "movie",
  });
  // Bob comments.
  await db.insert(showCommentsTable).values({
    userId: BOB,
    authorName: "Bob",
    titleKey: MOVIE_KEY,
    mediaType: "movie",
    body: "Classic.",
  });
  // Alice approves; Bob flags it spicy. (poll rows store only userId.)
  await db.insert(showApprovalsTable).values({
    userId: ALICE,
    titleKey: MOVIE_KEY,
    mediaType: "movie",
    approval: "yes",
  });
  await db.insert(showSpiceTable).values({
    userId: BOB,
    titleKey: MOVIE_KEY,
    mediaType: "movie",
    spicy: "yes",
  });
});

afterAll(async () => {
  await db.delete(entriesTable).where(inArray(entriesTable.userId, ALL_USERS));
  await db
    .delete(watchlistItemsTable)
    .where(inArray(watchlistItemsTable.userId, ALL_USERS));
  await db
    .delete(showCommentsTable)
    .where(inArray(showCommentsTable.userId, ALL_USERS));
  await db
    .delete(showApprovalsTable)
    .where(inArray(showApprovalsTable.userId, ALL_USERS));
  await db.delete(showSpiceTable).where(inArray(showSpiceTable.userId, ALL_USERS));
  await db
    .delete(groupMembersTable)
    .where(inArray(groupMembersTable.userId, ALL_USERS));
  await db.delete(groupsTable).where(inArray(groupsTable.ownerId, ALL_USERS));
  await pool.end();
});

describe("GET /activity/feed", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/activity/feed");
    expect(res.status).toBe(401);
  });

  it("returns the whole group's activity, newest first", async () => {
    const res = await request(app)
      .get("/api/activity/feed")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    const types = res.body.map((i: { type: string }) => i.type).sort();
    expect(types).toEqual(["approval", "comment", "rating", "spice", "watchlist"]);

    // Poll rows store only userId; the feed must resolve display names from the
    // group membership map, not raw ids.
    const approval = res.body.find((i: { type: string }) => i.type === "approval");
    expect(approval.actorName).toBe("Alice");
    expect(approval.approval).toBe("yes");

    // Comment/approval/spice carry only a titleKey, so they must inherit the
    // display title + linkable entry id from Alice's rating entry.
    const spice = res.body.find((i: { type: string }) => i.type === "spice");
    expect(spice.actorName).toBe("Bob");
    expect(spice.title).toBe(MOVIE);
    expect(spice.entryId).not.toBeNull();

    const rating = res.body.find((i: { type: string }) => i.type === "rating");
    expect(rating.rating).toBe(5);
    expect(rating.entryId).not.toBeNull();
  });

  it("without a group, returns only the caller's own activity", async () => {
    const res = await request(app)
      .get("/api/activity/feed")
      .set(as(BOB));
    expect(res.status).toBe(200);
    // Bob alone: watchlist save, comment, spice flag (no rating/approval).
    const types = res.body.map((i: { type: string }) => i.type).sort();
    expect(types).toEqual(["comment", "spice", "watchlist"]);
  });

  it("forbids reading a group you do not belong to", async () => {
    const res = await request(app)
      .get("/api/activity/feed")
      .query({ groupId: group1Id })
      .set(as(CAROL));
    expect(res.status).toBe(403);
  });

  it("honors the limit param", async () => {
    const res = await request(app)
      .get("/api/activity/feed")
      .query({ groupId: group1Id, limit: 2 })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
