import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  groupsTable,
  groupMembersTable,
  listsTable,
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
  const owned = await db
    .select({ id: listsTable.id })
    .from(listsTable)
    .where(inArray(listsTable.ownerId, ALL_USERS));
  if (owned.length > 0) {
    await db.delete(listsTable).where(
      inArray(
        listsTable.id,
        owned.map((l) => l.id),
      ),
    );
  }
  await db
    .delete(groupMembersTable)
    .where(inArray(groupMembersTable.userId, ALL_USERS));
  await db.delete(groupsTable).where(inArray(groupsTable.ownerId, ALL_USERS));
  await pool.end();
});

describe("POST /lists", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .post("/api/lists")
      .send({ name: "Guys Night Picks" });
    expect(res.status).toBe(401);
  });

  it("creates a list owned by the caller", async () => {
    const res = await request(app)
      .post("/api/lists")
      .set(as(ALICE))
      .send({ name: "  Guys Night Picks  ", description: "  Loud and dumb  " });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Guys Night Picks");
    expect(res.body.description).toBe("Loud and dumb");
    expect(res.body.ownerId).toBe(ALICE);
    expect(res.body.itemCount).toBe(0);
  });

  it("rejects a blank name", async () => {
    const res = await request(app)
      .post("/api/lists")
      .set(as(ALICE))
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("rejects a whitespace-only name", async () => {
    const res = await request(app)
      .post("/api/lists")
      .set(as(ALICE))
      .send({ name: "   " });
    expect(res.status).toBe(400);
  });
});

describe("lists items + browse", () => {
  let listId: number;

  it("adds items as the owner", async () => {
    const created = await request(app)
      .post("/api/lists")
      .set(as(ALICE))
      .send({ name: "Best Dad Movies" });
    listId = created.body.id;

    const a = await request(app)
      .post(`/api/lists/${listId}/items`)
      .set(as(ALICE))
      .send({ title: "  Field of Dreams  ", mediaType: "movie" });
    expect(a.status).toBe(201);
    expect(a.body.title).toBe("Field of Dreams");

    const b = await request(app)
      .post(`/api/lists/${listId}/items`)
      .set(as(ALICE))
      .send({ title: "Bluey", mediaType: "tv" });
    expect(b.status).toBe(201);
  });

  it("rejects a whitespace-only item title", async () => {
    const res = await request(app)
      .post(`/api/lists/${listId}/items`)
      .set(as(ALICE))
      .send({ title: "   ", mediaType: "movie" });
    expect(res.status).toBe(400);
  });

  it("forbids a non-owner from adding items", async () => {
    const res = await request(app)
      .post(`/api/lists/${listId}/items`)
      .set(as(BOB))
      .send({ title: "Sneaky Add", mediaType: "movie" });
    expect(res.status).toBe(403);
  });

  it("lets a group member open and read the list", async () => {
    const res = await request(app).get(`/api/lists/${listId}`).set(as(BOB));
    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(ALICE);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].title).toBe("Field of Dreams");
  });

  it("forbids a non-group-mate from opening the list", async () => {
    const res = await request(app).get(`/api/lists/${listId}`).set(as(CAROL));
    expect(res.status).toBe(403);
  });

  it("browses lists owned by all members of a group", async () => {
    await request(app)
      .post("/api/lists")
      .set(as(BOB))
      .send({ name: "Wife Made Me Watch It" });

    const res = await request(app)
      .get("/api/lists")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    const names = res.body.map((l: { name: string }) => l.name);
    expect(names).toContain("Best Dad Movies");
    expect(names).toContain("Wife Made Me Watch It");
    const dadList = res.body.find(
      (l: { name: string }) => l.name === "Best Dad Movies",
    );
    expect(dadList.itemCount).toBe(2);
  });

  it("forbids browsing a group you don't belong to", async () => {
    const res = await request(app)
      .get("/api/lists")
      .query({ groupId: group2Id })
      .set(as(ALICE));
    expect(res.status).toBe(403);
  });

  it("removes an item as the owner", async () => {
    const detail = await request(app)
      .get(`/api/lists/${listId}`)
      .set(as(ALICE));
    const itemId = detail.body.items[0].id;
    const del = await request(app)
      .delete(`/api/lists/${listId}/items/${itemId}`)
      .set(as(ALICE));
    expect(del.status).toBe(204);

    const after = await request(app).get(`/api/lists/${listId}`).set(as(ALICE));
    expect(after.body.items).toHaveLength(1);
  });
});

describe("PATCH /lists/:id", () => {
  let listId: number;

  beforeAll(async () => {
    const created = await request(app)
      .post("/api/lists")
      .set(as(ALICE))
      .send({ name: "Original Name", description: "Original desc" });
    listId = created.body.id;
  });

  it("lets the owner edit name and clear description", async () => {
    const res = await request(app)
      .patch(`/api/lists/${listId}`)
      .set(as(ALICE))
      .send({ name: "New Name", description: null });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
    expect(res.body.description).toBeNull();
  });

  it("rejects a whitespace-only name on edit", async () => {
    const res = await request(app)
      .patch(`/api/lists/${listId}`)
      .set(as(ALICE))
      .send({ name: "   " });
    expect(res.status).toBe(400);
  });

  it("forbids a non-owner from editing", async () => {
    const res = await request(app)
      .patch(`/api/lists/${listId}`)
      .set(as(BOB))
      .send({ name: "Hijacked" });
    expect(res.status).toBe(403);
  });

  it("deletes the list as the owner", async () => {
    const del = await request(app)
      .delete(`/api/lists/${listId}`)
      .set(as(ALICE));
    expect(del.status).toBe(204);
    const after = await request(app).get(`/api/lists/${listId}`).set(as(ALICE));
    expect(after.status).toBe(404);
  });
});
