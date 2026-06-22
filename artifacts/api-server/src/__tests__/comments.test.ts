import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { inArray, and, eq } from "drizzle-orm";
import {
  db,
  pool,
  groupsTable,
  groupMembersTable,
  showCommentsTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";

const app = makeTestApp();

const RUN = `c${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;
const BOB = `${RUN}_bob`;
const CAROL = `${RUN}_carol`;
const ALL_USERS = [ALICE, BOB, CAROL];

// Group 1 = { alice, bob }; Group 2 = { carol }.
let group1Id: number;
let group2Id: number;

const SHOW = { title: "Interstellar", mediaType: "movie" as const };
const SHOW_KEY = "interstellar";

let aliceCommentId: number;

function as(userId: string) {
  return { "x-test-user-id": userId };
}

async function showRowCount(): Promise<number> {
  const rows = await db
    .select({ id: showCommentsTable.id })
    .from(showCommentsTable)
    .where(
      and(
        eq(showCommentsTable.titleKey, SHOW_KEY),
        eq(showCommentsTable.mediaType, SHOW.mediaType),
      ),
    );
  return rows.length;
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
});

afterAll(async () => {
  await db
    .delete(showCommentsTable)
    .where(inArray(showCommentsTable.userId, ALL_USERS));
  await db
    .delete(groupMembersTable)
    .where(inArray(groupMembersTable.userId, ALL_USERS));
  await db
    .delete(groupsTable)
    .where(inArray(groupsTable.ownerId, ALL_USERS));
  await pool.end();
});

describe("POST /comments", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .post("/api/comments")
      .send({ ...SHOW, body: "hi" });
    expect(res.status).toBe(401);
  });

  it("lets a group member post a top-level comment", async () => {
    const res = await request(app)
      .post("/api/comments")
      .set(as(ALICE))
      .send({ ...SHOW, body: "Loved the ending.", groupId: group1Id });
    expect(res.status).toBe(201);
    expect(res.body.authorName).toBe(ALICE);
    expect(res.body.parentId).toBeNull();
    expect(res.body.body).toBe("Loved the ending.");
    aliceCommentId = res.body.id;
  });

  it("lets another member reply, nesting under the parent", async () => {
    const res = await request(app)
      .post("/api/comments")
      .set(as(BOB))
      .send({
        ...SHOW,
        body: "Agreed, the score was incredible.",
        parentId: aliceCommentId,
        groupId: group1Id,
      });
    expect(res.status).toBe(201);
    expect(res.body.authorName).toBe(BOB);
    expect(res.body.parentId).toBe(aliceCommentId);
  });

  it("rejects a reply whose parent is on a different show, with no side effect", async () => {
    const before = await showRowCount();
    const res = await request(app)
      .post("/api/comments")
      .set(as(ALICE))
      .send({
        title: "Tenet",
        mediaType: "movie",
        body: "wrong thread",
        parentId: aliceCommentId,
        groupId: group1Id,
      });
    expect(res.status).toBe(400);
    // The bogus reply targeted the Interstellar parent, so Interstellar's count
    // must be unchanged; and no "Tenet" row should have been created either.
    expect(await showRowCount()).toBe(before);
    const tenet = await db
      .select({ id: showCommentsTable.id })
      .from(showCommentsTable)
      .where(eq(showCommentsTable.titleKey, "tenet"));
    expect(tenet).toHaveLength(0);
  });

  it("forbids posting to a group you do not belong to, with no side effect", async () => {
    const before = await showRowCount();
    const res = await request(app)
      .post("/api/comments")
      .set(as(CAROL))
      .send({ ...SHOW, body: "sneaking in", groupId: group1Id });
    expect(res.status).toBe(403);
    expect(await showRowCount()).toBe(before);
  });
});

describe("GET /comments", () => {
  it("returns the whole group's thread, oldest first", async () => {
    const res = await request(app)
      .get("/api/comments")
      .query({ ...SHOW, groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(aliceCommentId);
    expect(res.body[0].parentId).toBeNull();
    expect(res.body[1].parentId).toBe(aliceCommentId);
    expect(res.body[1].authorName).toBe(BOB);
  });

  it("without a group, returns only the caller's own comments", async () => {
    const res = await request(app)
      .get("/api/comments")
      .query(SHOW)
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].authorName).toBe(ALICE);
  });

  it("forbids reading a group you do not belong to", async () => {
    const res = await request(app)
      .get("/api/comments")
      .query({ ...SHOW, groupId: group1Id })
      .set(as(CAROL));
    expect(res.status).toBe(403);
  });

  it("does not surface the thread to outsiders even via their own group", async () => {
    const res = await request(app)
      .get("/api/comments")
      .query({ ...SHOW, groupId: group2Id })
      .set(as(CAROL));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
