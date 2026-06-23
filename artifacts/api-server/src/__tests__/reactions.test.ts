import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  groupsTable,
  groupMembersTable,
  entriesTable,
  reactionsTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";
import request from "supertest";

const app = makeTestApp();

const RUN = `r${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;
const BOB = `${RUN}_bob`;
const CAROL = `${RUN}_carol`;
const ALL_USERS = [ALICE, BOB, CAROL];

// Group 1 = { alice, bob }; Group 2 = { carol }.
let group1Id: number;
let group2Id: number;

// An entry authored by Alice (visible to group 1) that everyone reacts to.
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
    { groupId: group1Id, userId: ALICE, displayName: ALICE, role: "owner" },
    { groupId: group1Id, userId: BOB, displayName: BOB, role: "member" },
    { groupId: group2Id, userId: CAROL, displayName: CAROL, role: "owner" },
  ]);

  const [entry] = await db
    .insert(entriesTable)
    .values({
      userId: ALICE,
      title: "Interstellar",
      mediaType: "movie",
      rating: 5,
      category: "Drama",
      addedBy: ALICE,
    })
    .returning();
  aliceEntryId = entry.id;
});

afterAll(async () => {
  await db.delete(reactionsTable).where(inArray(reactionsTable.userId, ALL_USERS));
  await db.delete(entriesTable).where(inArray(entriesTable.userId, ALL_USERS));
  await db
    .delete(groupMembersTable)
    .where(inArray(groupMembersTable.userId, ALL_USERS));
  await db.delete(groupsTable).where(inArray(groupsTable.ownerId, ALL_USERS));
  await pool.end();
});

describe("POST /reactions", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .post("/api/reactions")
      .send({ targetType: "entry", targetId: aliceEntryId, emoji: "👍" });
    expect(res.status).toBe(401);
  });

  it("adds a caller's reaction and returns the fresh summary", async () => {
    const res = await request(app)
      .post("/api/reactions")
      .set(as(ALICE))
      .send({
        targetType: "entry",
        targetId: aliceEntryId,
        emoji: "👍",
        groupId: group1Id,
      });
    expect(res.status).toBe(200);
    expect(res.body.targetType).toBe("entry");
    expect(res.body.targetId).toBe(aliceEntryId);
    expect(res.body.emojis).toEqual([{ emoji: "👍", count: 1 }]);
    expect(res.body.mine).toEqual(["👍"]);
  });

  it("counts a second member's reaction in the group-scoped summary", async () => {
    const res = await request(app)
      .post("/api/reactions")
      .set(as(BOB))
      .send({
        targetType: "entry",
        targetId: aliceEntryId,
        emoji: "👍",
        groupId: group1Id,
      });
    expect(res.status).toBe(200);
    expect(res.body.emojis).toEqual([{ emoji: "👍", count: 2 }]);
    // BOB sees only his own emoji as "mine".
    expect(res.body.mine).toEqual(["👍"]);
  });

  it("toggles off when the same emoji is sent again", async () => {
    const res = await request(app)
      .post("/api/reactions")
      .set(as(BOB))
      .send({
        targetType: "entry",
        targetId: aliceEntryId,
        emoji: "👍",
        groupId: group1Id,
      });
    expect(res.status).toBe(200);
    expect(res.body.emojis).toEqual([{ emoji: "👍", count: 1 }]);
    expect(res.body.mine).toEqual([]);
  });

  it("forbids reacting within a group the caller does not belong to, with no side effect", async () => {
    const before = await db
      .select({ id: reactionsTable.id })
      .from(reactionsTable)
      .where(inArray(reactionsTable.userId, ALL_USERS));
    const res = await request(app)
      .post("/api/reactions")
      .set(as(CAROL))
      .send({
        targetType: "entry",
        targetId: aliceEntryId,
        emoji: "👎",
        groupId: group1Id,
      });
    expect(res.status).toBe(403);
    const after = await db
      .select({ id: reactionsTable.id })
      .from(reactionsTable)
      .where(inArray(reactionsTable.userId, ALL_USERS));
    expect(after.length).toBe(before.length);
  });

  it("rejects a target that is not visible to the member set", async () => {
    // Carol's own group has no access to Alice's entry → invalid target.
    const res = await request(app)
      .post("/api/reactions")
      .set(as(CAROL))
      .send({
        targetType: "entry",
        targetId: aliceEntryId,
        emoji: "👎",
        groupId: group2Id,
      });
    expect(res.status).toBe(400);
  });
});

describe("GET /reactions", () => {
  it("returns the group's reaction summaries", async () => {
    const res = await request(app)
      .get("/api/reactions")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    const summary = res.body.find(
      (s: { targetType: string; targetId: number }) =>
        s.targetType === "entry" && s.targetId === aliceEntryId,
    );
    expect(summary).toBeDefined();
    expect(summary.emojis).toEqual([{ emoji: "👍", count: 1 }]);
    expect(summary.mine).toEqual(["👍"]);
  });

  it("forbids reading a group the caller does not belong to", async () => {
    const res = await request(app)
      .get("/api/reactions")
      .query({ groupId: group1Id })
      .set(as(CAROL));
    expect(res.status).toBe(403);
  });

  it("drops targets whose only reactions use retired legacy emojis", async () => {
    // Bob authors an entry and the only reaction on it is a legacy emoji from
    // the old set. The feed must not 500 and must omit that target entirely.
    const [legacyEntry] = await db
      .insert(entriesTable)
      .values({
        userId: BOB,
        title: "Dune",
        mediaType: "movie",
        rating: 4,
        category: "Drama",
        addedBy: BOB,
      })
      .returning();
    await db.insert(reactionsTable).values({
      userId: ALICE,
      targetType: "entry",
      targetId: legacyEntry.id,
      emoji: "🔥",
    });

    const res = await request(app)
      .get("/api/reactions")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    const legacy = res.body.find(
      (s: { targetType: string; targetId: number }) =>
        s.targetType === "entry" && s.targetId === legacyEntry.id,
    );
    expect(legacy).toBeUndefined();
  });

  it("does not leak a target across groups via a multi-group member", async () => {
    // Bob joins Carol's group (group2) too. Bob reacts to Carol's OWN entry
    // (visible only to group2). That reaction must NOT surface in group1's
    // summary even though Bob — a group1 member — is the reactor.
    await db.insert(groupMembersTable).values({
      groupId: group2Id,
      userId: BOB,
      displayName: BOB,
      role: "member",
    });
    const [carolEntry] = await db
      .insert(entriesTable)
      .values({
        userId: CAROL,
        title: "Arrival",
        mediaType: "movie",
        rating: 4,
        category: "Drama",
        addedBy: CAROL,
      })
      .returning();

    const react = await request(app)
      .post("/api/reactions")
      .set(as(BOB))
      .send({
        targetType: "entry",
        targetId: carolEntry.id,
        emoji: "👎",
        groupId: group2Id,
      });
    expect(react.status).toBe(200);

    // Group1 caller must not see Carol's entry (its author is not in group1).
    const g1 = await request(app)
      .get("/api/reactions")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(g1.status).toBe(200);
    const leaked = g1.body.find(
      (s: { targetType: string; targetId: number }) =>
        s.targetType === "entry" && s.targetId === carolEntry.id,
    );
    expect(leaked).toBeUndefined();

    // But group2 (where Carol's entry lives) does include it.
    const g2 = await request(app)
      .get("/api/reactions")
      .query({ groupId: group2Id })
      .set(as(CAROL));
    expect(g2.status).toBe(200);
    const visible = g2.body.find(
      (s: { targetType: string; targetId: number }) =>
        s.targetType === "entry" && s.targetId === carolEntry.id,
    );
    expect(visible).toBeDefined();
    expect(visible.emojis).toEqual([{ emoji: "👎", count: 1 }]);
  });
});
