import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  groupsTable,
  groupMembersTable,
  topFourTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";

const app = makeTestApp();

const RUN = `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;
const BOB = `${RUN}_bob`;
const CAROL = `${RUN}_carol`;
const ALL_USERS = [ALICE, BOB, CAROL];

// Group 1 = { alice, bob }; Group 2 = { carol } (no overlap with alice/bob).
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
});

afterAll(async () => {
  await db.delete(topFourTable).where(inArray(topFourTable.userId, ALL_USERS));
  await db
    .delete(groupMembersTable)
    .where(inArray(groupMembersTable.userId, ALL_USERS));
  await db.delete(groupsTable).where(inArray(groupsTable.ownerId, ALL_USERS));
  await pool.end();
});

describe("PUT /top-four", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .put("/api/top-four")
      .send({ picks: [{ title: "Heat", mediaType: "movie" }] });
    expect(res.status).toBe(401);
  });

  it("saves the caller's ordered picks, reindexed by position", async () => {
    const res = await request(app)
      .put("/api/top-four")
      .set(as(ALICE))
      .send({
        picks: [
          { title: "Heat", mediaType: "movie" },
          { title: "The Wire", mediaType: "tv" },
          { title: "Dune", mediaType: "movie" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((p: { position: number }) => p.position)).toEqual([
      0, 1, 2,
    ]);
    expect(res.body[0].title).toBe("Heat");
    expect(res.body[1].mediaType).toBe("tv");
  });

  it("caps at four and drops blank titles", async () => {
    const res = await request(app)
      .put("/api/top-four")
      .set(as(BOB))
      .send({
        picks: [
          { title: "  Fargo  ", mediaType: "tv" },
          { title: "   ", mediaType: "movie" },
          { title: "Sicario", mediaType: "movie" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe("Fargo");
    expect(res.body[1].title).toBe("Sicario");
  });

  it("rejects more than four picks", async () => {
    const res = await request(app)
      .put("/api/top-four")
      .set(as(ALICE))
      .send({
        picks: [
          { title: "A", mediaType: "movie" },
          { title: "B", mediaType: "movie" },
          { title: "C", mediaType: "movie" },
          { title: "D", mediaType: "movie" },
          { title: "E", mediaType: "movie" },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("replaces the whole set on a subsequent save", async () => {
    const res = await request(app)
      .put("/api/top-four")
      .set(as(ALICE))
      .send({ picks: [{ title: "Drive", mediaType: "movie" }] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Drive");
    expect(res.body[0].position).toBe(0);
  });
});

describe("GET /top-four", () => {
  it("returns the caller's own picks by default", async () => {
    const res = await request(app).get("/api/top-four").set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Drive");
  });

  it("lets a group member view another member's picks", async () => {
    const res = await request(app)
      .get("/api/top-four")
      .query({ userId: BOB })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe("Fargo");
  });

  it("forbids viewing a non-group-mate's picks", async () => {
    const res = await request(app)
      .get("/api/top-four")
      .query({ userId: ALICE })
      .set(as(CAROL));
    expect(res.status).toBe(403);
  });
});
