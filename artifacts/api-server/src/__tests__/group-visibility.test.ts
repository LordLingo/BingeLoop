import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  entriesTable,
  groupsTable,
  groupMembersTable,
  watchlistItemsTable,
  showAudiencesTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";

const app = makeTestApp();

// Unique-per-run identifiers so the suite never collides with real data and can
// clean up exactly what it created.
const RUN = `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;
const BOB = `${RUN}_bob`;
const CAROL = `${RUN}_carol`;
const DAVE = `${RUN}_dave`;
const ALL_USERS = [ALICE, BOB, CAROL, DAVE];

// Group 1 = { alice, bob }; Group 2 = { carol }.
// Alice shares a group with Bob, but shares nothing with Carol.
let group1Id: number;
let group2Id: number;
// Dave belongs to BOTH groupA and groupB (multi-group isolation checks).
let groupAId: number;
let groupBId: number;

// Entry ids for direct-fetch (GET /entries/:id) checks.
let bobEntryId: number;
let carolEntryId: number;

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

  const [gA] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} Group A`, ownerId: DAVE })
    .returning();
  const [gB] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} Group B`, ownerId: DAVE })
    .returning();
  groupAId = gA.id;
  groupBId = gB.id;

  await db.insert(groupMembersTable).values([
    {
      groupId: group1Id,
      userId: ALICE,
      displayName: ALICE,
      role: "owner",
    },
    {
      groupId: group1Id,
      userId: BOB,
      displayName: BOB,
      role: "member",
    },
    {
      groupId: group2Id,
      userId: CAROL,
      displayName: CAROL,
      role: "owner",
    },
    {
      groupId: groupAId,
      userId: DAVE,
      displayName: DAVE,
      role: "owner",
    },
    {
      groupId: groupBId,
      userId: DAVE,
      displayName: DAVE,
      role: "owner",
    },
  ]);

  // Alice: 2 entries. Bob: 1 (shares the "Dune" title with Alice). Carol: 1.
  // Each entry is tagged with the group it was added to.
  const inserted = await db
    .insert(entriesTable)
    .values([
      {
        title: "Dune",
        mediaType: "movie",
        rating: 5,
        category: "Sci-Fi",
        userId: ALICE,
        addedBy: ALICE,
        groupId: group1Id,
      },
      {
        title: "Severance",
        mediaType: "tv",
        rating: 4,
        category: "Thriller",
        userId: ALICE,
        addedBy: ALICE,
        groupId: group1Id,
      },
      {
        title: "Dune",
        mediaType: "movie",
        rating: 3,
        category: "Sci-Fi",
        userId: BOB,
        addedBy: BOB,
        groupId: group1Id,
      },
      {
        title: "Oppenheimer",
        mediaType: "movie",
        rating: 5,
        category: "Drama",
        userId: CAROL,
        addedBy: CAROL,
        groupId: group2Id,
      },
    ])
    .returning();
  bobEntryId = inserted.find((e) => e.userId === BOB)!.id;
  carolEntryId = inserted.find((e) => e.userId === CAROL)!.id;

  // Dave belongs to groupA and groupB. He has one entry in each, plus one
  // legacy entry with no group (groupId NULL) for the unassigned/triage checks.
  await db.insert(entriesTable).values([
    {
      title: "Show A",
      mediaType: "tv",
      rating: 4,
      category: "Drama",
      userId: DAVE,
      addedBy: DAVE,
      groupId: groupAId,
    },
    {
      title: "Show B",
      mediaType: "tv",
      rating: 5,
      category: "Comedy",
      userId: DAVE,
      addedBy: DAVE,
      groupId: groupBId,
    },
    {
      title: "Legacy Show",
      mediaType: "movie",
      rating: 3,
      category: "Thriller",
      userId: DAVE,
      addedBy: DAVE,
      groupId: null,
    },
  ]);

  // Watchlist: Alice saves "Dune" (Bob has rated it -> alsoEngagedBy candidate).
  await db.insert(watchlistItemsTable).values([
    {
      userId: ALICE,
      addedBy: ALICE,
      title: "Dune",
      titleKey: "dune",
      mediaType: "movie",
    },
    {
      userId: BOB,
      addedBy: BOB,
      title: "Severance",
      titleKey: "severance",
      mediaType: "tv",
    },
  ]);

  // Audiences on "Dune" movie: Alice=[couples], Bob=[guys] (same group),
  // Carol=[couples] (other group).
  await db.insert(showAudiencesTable).values([
    { userId: ALICE, titleKey: "dune", mediaType: "movie", audiences: ["couples"] },
    { userId: BOB, titleKey: "dune", mediaType: "movie", audiences: ["guys"] },
    { userId: CAROL, titleKey: "dune", mediaType: "movie", audiences: ["couples"] },
  ]);
});

afterAll(async () => {
  await db.delete(entriesTable).where(inArray(entriesTable.userId, ALL_USERS));
  await db
    .delete(watchlistItemsTable)
    .where(inArray(watchlistItemsTable.userId, ALL_USERS));
  await db
    .delete(showAudiencesTable)
    .where(inArray(showAudiencesTable.userId, ALL_USERS));
  await db
    .delete(groupMembersTable)
    .where(inArray(groupMembersTable.userId, ALL_USERS));
  await db
    .delete(groupsTable)
    .where(inArray(groupsTable.ownerId, ALL_USERS));
  await pool.end();
});

describe("auth", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/entries");
    expect(res.status).toBe(401);
  });
});

describe("GET /entries visibility matrix", () => {
  it("default (no params) returns only the caller's own entries", async () => {
    const res = await request(app).get("/api/entries").set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // The Entry response omits userId; addedBy is the per-user attribution
    // snapshot (seeded equal to the user id here).
    expect(res.body.every((e: { addedBy: string }) => e.addedBy === ALICE)).toBe(
      true,
    );
  });

  it("userId of a user you share a group with returns that user's entries", async () => {
    const res = await request(app)
      .get("/api/entries")
      .query({ userId: BOB })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].addedBy).toBe(BOB);
  });

  it("userId of a user you do NOT share a group with is forbidden", async () => {
    const res = await request(app)
      .get("/api/entries")
      .query({ userId: CAROL })
      .set(as(ALICE));
    expect(res.status).toBe(403);
  });

  it("groupId you belong to returns all members' entries", async () => {
    const res = await request(app)
      .get("/api/entries")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    // Alice (2) + Bob (1)
    expect(res.body).toHaveLength(3);
    const addedBy = new Set(res.body.map((e: { addedBy: string }) => e.addedBy));
    expect(addedBy).toEqual(new Set([ALICE, BOB]));
    expect(addedBy.has(CAROL)).toBe(false);
  });

  it("groupId you do NOT belong to is forbidden", async () => {
    const res = await request(app)
      .get("/api/entries")
      .query({ groupId: group2Id })
      .set(as(ALICE));
    expect(res.status).toBe(403);
  });

  it("does not leak another member's entries into the personal default", async () => {
    // Alice shares a group with Bob, but the default scope is still personal.
    const res = await request(app).get("/api/entries").set(as(ALICE));
    const userIds = res.body.map((e: { userId: string }) => e.userId);
    expect(userIds).not.toContain(BOB);
  });
});

describe("GET /stats visibility matrix", () => {
  it("default (no params) aggregates only the caller's own entries", async () => {
    const res = await request(app).get("/api/stats").set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.movieCount).toBe(1);
    expect(res.body.tvCount).toBe(1);
  });

  it("userId of a shared member aggregates that member's entries", async () => {
    const res = await request(app)
      .get("/api/stats")
      .query({ userId: BOB })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it("userId of a non-shared user is forbidden", async () => {
    const res = await request(app)
      .get("/api/stats")
      .query({ userId: CAROL })
      .set(as(ALICE));
    expect(res.status).toBe(403);
  });

  it("groupId you belong to aggregates all members; totals match the entries view", async () => {
    const res = await request(app)
      .get("/api/stats")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.movieCount).toBe(2); // 2x Dune
    expect(res.body.tvCount).toBe(1); // Severance
  });

  it("groupId you do NOT belong to is forbidden", async () => {
    const res = await request(app)
      .get("/api/stats")
      .query({ groupId: group2Id })
      .set(as(ALICE));
    expect(res.status).toBe(403);
  });
});

describe("entries are scoped to the group they were added to", () => {
  it("a group library shows only entries tagged to that group", async () => {
    const resA = await request(app)
      .get("/api/entries")
      .query({ groupId: groupAId })
      .set(as(DAVE));
    expect(resA.status).toBe(200);
    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].title).toBe("Show A");

    const resB = await request(app)
      .get("/api/entries")
      .query({ groupId: groupBId })
      .set(as(DAVE));
    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(1);
    expect(resB.body[0].title).toBe("Show B");
  });

  it("stats for a group aggregate only that group's entries", async () => {
    const resA = await request(app)
      .get("/api/stats")
      .query({ groupId: groupAId })
      .set(as(DAVE));
    expect(resA.status).toBe(200);
    expect(resA.body.total).toBe(1);
    expect(resA.body.tvCount).toBe(1);
  });

  it("the member-profile (userId) view returns all the user's entries across groups", async () => {
    // Dave's full library spans groupA, groupB and one unassigned entry.
    const res = await request(app).get("/api/entries").set(as(DAVE));
    expect(res.status).toBe(200);
    const titles = res.body.map((e: { title: string }) => e.title).sort();
    expect(titles).toEqual(["Legacy Show", "Show A", "Show B"]);
  });

  it("unassigned=true returns only the caller's group-less entries", async () => {
    const res = await request(app)
      .get("/api/entries")
      .query({ unassigned: true })
      .set(as(DAVE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Legacy Show");
    expect(res.body[0].groupId).toBeNull();
  });

  it("POST persists groupId when the caller is a member", async () => {
    const create = await request(app)
      .post("/api/entries")
      .send({
        title: "New In Group A",
        mediaType: "movie",
        rating: 4,
        category: "Drama",
        groupId: groupAId,
      })
      .set(as(DAVE));
    expect(create.status).toBe(201);
    expect(create.body.groupId).toBe(groupAId);

    const list = await request(app)
      .get("/api/entries")
      .query({ groupId: groupAId })
      .set(as(DAVE));
    const titles = list.body.map((e: { title: string }) => e.title);
    expect(titles).toContain("New In Group A");
  });

  it("POST with a groupId the caller does NOT belong to is forbidden", async () => {
    const res = await request(app)
      .post("/api/entries")
      .send({
        title: "Intruder",
        mediaType: "movie",
        rating: 2,
        category: "Drama",
        groupId: group1Id,
      })
      .set(as(DAVE));
    expect(res.status).toBe(403);
  });

  it("PATCH to a group the caller does NOT belong to is forbidden and has no side effect", async () => {
    const listA = await request(app)
      .get("/api/entries")
      .query({ groupId: groupAId })
      .set(as(DAVE));
    const showA = listA.body.find(
      (e: { title: string }) => e.title === "Show A",
    );
    expect(showA).toBeDefined();

    // group1 is Alice/Bob's group; Dave is not a member.
    const patch = await request(app)
      .patch(`/api/entries/${showA.id}`)
      .send({ groupId: group1Id })
      .set(as(DAVE));
    expect(patch.status).toBe(403);

    // The entry must remain tagged to groupA — no partial mutation occurred.
    const after = await request(app)
      .get(`/api/entries/${showA.id}`)
      .set(as(DAVE));
    expect(after.status).toBe(200);
    expect(after.body.groupId).toBe(groupAId);
  });

  it("PATCH assigns an unassigned entry to a group the caller belongs to", async () => {
    const unassigned = await request(app)
      .get("/api/entries")
      .query({ unassigned: true })
      .set(as(DAVE));
    const legacy = unassigned.body.find(
      (e: { title: string }) => e.title === "Legacy Show",
    );
    expect(legacy).toBeDefined();

    const patch = await request(app)
      .patch(`/api/entries/${legacy.id}`)
      .send({ groupId: groupBId })
      .set(as(DAVE));
    expect(patch.status).toBe(200);
    expect(patch.body.groupId).toBe(groupBId);

    const list = await request(app)
      .get("/api/entries")
      .query({ groupId: groupBId })
      .set(as(DAVE));
    const titles = list.body.map((e: { title: string }) => e.title);
    expect(titles).toContain("Legacy Show");
  });
});

describe("GET /entries/:id direct access", () => {
  it("allows fetching an entry of a member you share a group with", async () => {
    const res = await request(app)
      .get(`/api/entries/${bobEntryId}`)
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.addedBy).toBe(BOB);
  });

  it("hides (404) an entry of a user you don't share a group with", async () => {
    const res = await request(app)
      .get(`/api/entries/${carolEntryId}`)
      .set(as(ALICE));
    expect(res.status).toBe(404);
  });
});

describe("watchlist stays personal", () => {
  it("default returns only the caller's own saved items", async () => {
    const res = await request(app).get("/api/watchlist").set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Dune");
  });

  it("a shared member's watchlist is viewable via userId", async () => {
    const res = await request(app)
      .get("/api/watchlist")
      .query({ userId: BOB })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Severance");
  });

  it("a non-shared user's watchlist is forbidden", async () => {
    const res = await request(app)
      .get("/api/watchlist")
      .query({ userId: CAROL })
      .set(as(ALICE));
    expect(res.status).toBe(403);
  });

  it("alsoEngagedBy is scoped to the passed group's other members", async () => {
    // With group1, Bob (who rated Dune) shows up; without a group nobody does.
    const withGroup = await request(app)
      .get("/api/watchlist")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(withGroup.status).toBe(200);
    const dune = withGroup.body.find(
      (i: { title: string }) => i.title === "Dune",
    );
    expect(dune.alsoEngagedBy).toContain(BOB);
    expect(dune.alsoEngagedBy).not.toContain(CAROL);

    const noGroup = await request(app).get("/api/watchlist").set(as(ALICE));
    const duneNoGroup = noGroup.body.find(
      (i: { title: string }) => i.title === "Dune",
    );
    expect(duneNoGroup.alsoEngagedBy).toEqual([]);
  });
});

describe("audience tallies stay scoped", () => {
  interface AudienceSummary {
    titleKey: string;
    mediaType: string;
    girls: number;
    guys: number;
    couples: number;
    solo: number;
    myAudiences: string[];
  }

  function findDune(body: AudienceSummary[]) {
    return body.find((s) => s.titleKey === "dune" && s.mediaType === "movie");
  }

  it("default (no group) counts only the caller's own picks", async () => {
    const res = await request(app).get("/api/audiences").set(as(ALICE));
    expect(res.status).toBe(200);
    const dune = findDune(res.body);
    expect(dune).toBeDefined();
    expect(dune!.couples).toBe(1);
    expect(dune!.guys).toBe(0);
    expect(dune!.myAudiences).toEqual(["couples"]);
  });

  it("with a group you belong to, counts every member but not outsiders", async () => {
    const res = await request(app)
      .get("/api/audiences")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    const dune = findDune(res.body);
    expect(dune).toBeDefined();
    // Alice = couples, Bob = guys. Carol's "couples" is in another group -> excluded.
    expect(dune!.couples).toBe(1);
    expect(dune!.guys).toBe(1);
  });
});
