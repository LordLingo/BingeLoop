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
  showApprovalsTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";

const app = makeTestApp();

// Unique-per-run identifiers so the suite never collides with real data and can
// clean up exactly what it created.
const RUN = `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;
const BOB = `${RUN}_bob`;
const CAROL = `${RUN}_carol`;
const ALL_USERS = [ALICE, BOB, CAROL];

// Group 1 = { alice, bob }; Group 2 = { carol }.
// Alice shares a group with Bob, but shares nothing with Carol.
let group1Id: number;
let group2Id: number;

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
  ]);

  // Alice: 2 entries. Bob: 1 (shares the "Dune" title with Alice). Carol: 1.
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
      },
      {
        title: "Severance",
        mediaType: "tv",
        rating: 4,
        category: "Thriller",
        userId: ALICE,
        addedBy: ALICE,
      },
      {
        title: "Dune",
        mediaType: "movie",
        rating: 3,
        category: "Sci-Fi",
        userId: BOB,
        addedBy: BOB,
      },
      {
        title: "Oppenheimer",
        mediaType: "movie",
        rating: 5,
        category: "Drama",
        userId: CAROL,
        addedBy: CAROL,
      },
    ])
    .returning();
  bobEntryId = inserted.find((e) => e.userId === BOB)!.id;
  carolEntryId = inserted.find((e) => e.userId === CAROL)!.id;

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

  // Approvals on "Dune" movie: Alice=yes, Bob=no (same group), Carol=yes (other group).
  await db.insert(showApprovalsTable).values([
    { userId: ALICE, titleKey: "dune", mediaType: "movie", approval: "yes" },
    { userId: BOB, titleKey: "dune", mediaType: "movie", approval: "no" },
    { userId: CAROL, titleKey: "dune", mediaType: "movie", approval: "yes" },
  ]);
});

afterAll(async () => {
  await db.delete(entriesTable).where(inArray(entriesTable.userId, ALL_USERS));
  await db
    .delete(watchlistItemsTable)
    .where(inArray(watchlistItemsTable.userId, ALL_USERS));
  await db
    .delete(showApprovalsTable)
    .where(inArray(showApprovalsTable.userId, ALL_USERS));
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

describe("approvals tallies stay scoped", () => {
  interface ApprovalSummary {
    titleKey: string;
    mediaType: string;
    yes: number;
    no: number;
    solo: number;
    myApproval: string | null;
  }

  function findDune(body: ApprovalSummary[]) {
    return body.find((s) => s.titleKey === "dune" && s.mediaType === "movie");
  }

  it("default (no group) counts only the caller's own answer", async () => {
    const res = await request(app).get("/api/approvals").set(as(ALICE));
    expect(res.status).toBe(200);
    const dune = findDune(res.body);
    expect(dune).toBeDefined();
    expect(dune!.yes).toBe(1);
    expect(dune!.no).toBe(0);
    expect(dune!.myApproval).toBe("yes");
  });

  it("with a group you belong to, counts every member but not outsiders", async () => {
    const res = await request(app)
      .get("/api/approvals")
      .query({ groupId: group1Id })
      .set(as(ALICE));
    expect(res.status).toBe(200);
    const dune = findDune(res.body);
    expect(dune).toBeDefined();
    // Alice = yes, Bob = no. Carol's "yes" is in another group -> excluded.
    expect(dune!.yes).toBe(1);
    expect(dune!.no).toBe(1);
  });
});
