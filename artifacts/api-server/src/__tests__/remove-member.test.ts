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
  invitesTable,
} from "@workspace/db";
import { makeTestApp } from "./testApp";

const app = makeTestApp();

const RUN = `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const OWNER = `${RUN}_owner`;
const MEMBER = `${RUN}_member`;
const OUTSIDER = `${RUN}_outsider`;
const ALL_USERS = [OWNER, MEMBER, OUTSIDER];

let groupId: number;
let memberEntryId: number;

function as(userId: string) {
  return { "x-test-user-id": userId };
}

beforeAll(async () => {
  const [g] = await db
    .insert(groupsTable)
    .values({ name: `${RUN} Crew`, ownerId: OWNER })
    .returning();
  groupId = g.id;

  await db.insert(groupMembersTable).values([
    { groupId, userId: OWNER, displayName: OWNER, role: "owner" },
    { groupId, userId: MEMBER, displayName: MEMBER, role: "member" },
  ]);

  // The member contributes an entry that must survive their removal.
  const insertedEntries = await db
    .insert(entriesTable)
    .values([
      {
        title: "The Bear",
        mediaType: "tv",
        rating: 5,
        category: "Drama",
        userId: MEMBER,
        addedBy: MEMBER,
        groupId,
      },
      {
        title: "Heat",
        mediaType: "movie",
        rating: 4,
        category: "Thriller",
        userId: OWNER,
        addedBy: OWNER,
        groupId,
      },
    ])
    .returning();
  memberEntryId = insertedEntries.find((e) => e.userId === MEMBER)!.id;

  // Non-entry artifacts the member contributed; these must also survive removal.
  await db.insert(watchlistItemsTable).values({
    userId: MEMBER,
    addedBy: MEMBER,
    title: "Andor",
    titleKey: "andor",
    mediaType: "tv",
  });
  await db.insert(showAudiencesTable).values({
    userId: MEMBER,
    titleKey: "the bear",
    mediaType: "tv",
    audiences: ["couples"],
  });
});

afterAll(async () => {
  await db.delete(entriesTable).where(inArray(entriesTable.userId, ALL_USERS));
  await db
    .delete(watchlistItemsTable)
    .where(inArray(watchlistItemsTable.userId, ALL_USERS));
  await db
    .delete(showAudiencesTable)
    .where(inArray(showAudiencesTable.userId, ALL_USERS));
  await db.delete(invitesTable).where(inArray(invitesTable.createdBy, ALL_USERS));
  await db
    .delete(groupMembersTable)
    .where(inArray(groupMembersTable.userId, ALL_USERS));
  await db.delete(groupsTable).where(inArray(groupsTable.ownerId, ALL_USERS));
  await pool.end();
});

describe("DELETE /groups/:id/members/:userId authorization", () => {
  it("rejects a non-owner trying to remove someone (403)", async () => {
    const res = await request(app)
      .delete(`/api/groups/${groupId}/members/${OWNER}`)
      .set(as(MEMBER));
    expect(res.status).toBe(403);
  });

  it("rejects the owner removing themselves (400)", async () => {
    const res = await request(app)
      .delete(`/api/groups/${groupId}/members/${OWNER}`)
      .set(as(OWNER));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the target is not an active member", async () => {
    const res = await request(app)
      .delete(`/api/groups/${groupId}/members/${OUTSIDER}`)
      .set(as(OWNER));
    expect(res.status).toBe(404);
  });
});

describe("removal revokes access but preserves content", () => {
  it("owner removes the member (204)", async () => {
    const res = await request(app)
      .delete(`/api/groups/${groupId}/members/${MEMBER}`)
      .set(as(OWNER));
    expect(res.status).toBe(204);
  });

  it("removed member can no longer read the group", async () => {
    const res = await request(app)
      .get(`/api/groups/${groupId}`)
      .set(as(MEMBER));
    expect(res.status).toBe(403);
  });

  it("removed member no longer sees the group's shows", async () => {
    const res = await request(app)
      .get("/api/entries")
      .query({ groupId })
      .set(as(MEMBER));
    expect(res.status).toBe(403);
  });

  it("removed member no longer lists the group", async () => {
    const res = await request(app).get("/api/groups").set(as(MEMBER));
    expect(res.status).toBe(200);
    expect(res.body.find((g: { id: number }) => g.id === groupId)).toBeUndefined();
  });

  it("the group's member list and count drop the removed member", async () => {
    const res = await request(app)
      .get(`/api/groups/${groupId}`)
      .set(as(OWNER));
    expect(res.status).toBe(200);
    expect(res.body.memberCount).toBe(1);
    const ids = res.body.members.map((m: { userId: string }) => m.userId);
    expect(ids).toEqual([OWNER]);
  });

  it("the removed member's content stays visible to the rest of the group", async () => {
    const res = await request(app)
      .get("/api/entries")
      .query({ groupId })
      .set(as(OWNER));
    expect(res.status).toBe(200);
    const addedBy = res.body.map((e: { addedBy: string }) => e.addedBy);
    // Owner's entry + the removed member's entry, still attributed to them.
    expect(addedBy).toContain(OWNER);
    expect(addedBy).toContain(MEMBER);
  });

  it("non-entry content (audience tally) still counts the removed member", async () => {
    const res = await request(app)
      .get("/api/audiences")
      .query({ groupId })
      .set(as(OWNER));
    expect(res.status).toBe(200);
    const bear = res.body.find(
      (s: { titleKey: string; mediaType: string }) =>
        s.titleKey === "the bear" && s.mediaType === "tv",
    );
    expect(bear).toBeDefined();
    expect(bear.couples).toBeGreaterThanOrEqual(1);
  });

  it("a removed member's watchlist is no longer visible via userId (no shared active group)", async () => {
    const res = await request(app)
      .get("/api/watchlist")
      .query({ userId: MEMBER })
      .set(as(OWNER));
    expect(res.status).toBe(403);
  });

  it("a removed member's group-tagged entry is still openable by an active member of that group", async () => {
    // Consistent with group-library retention: the entry still appears in the
    // group's library, so an active member can open it directly by id.
    const res = await request(app)
      .get(`/api/entries/${memberEntryId}`)
      .set(as(OWNER));
    expect(res.status).toBe(200);
    expect(res.body.addedBy).toBe(MEMBER);
  });

  it("a removed member's entry is NOT openable by someone outside its group", async () => {
    const res = await request(app)
      .get(`/api/entries/${memberEntryId}`)
      .set(as(OUTSIDER));
    expect(res.status).toBe(404);
  });
});

describe("a removed member can rejoin via invite (reactivation)", () => {
  it("accepting an invite reactivates the removed row and restores access", async () => {
    const inviteRes = await request(app)
      .post(`/api/groups/${groupId}/invite`)
      .set(as(OWNER));
    expect(inviteRes.status).toBe(200);
    const token = inviteRes.body.token as string;

    const acceptRes = await request(app)
      .post(`/api/invites/${token}/accept`)
      .set(as(MEMBER));
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.joined).toBe(true);

    // Access restored: the member can read the group again.
    const groupRes = await request(app)
      .get(`/api/groups/${groupId}`)
      .set(as(MEMBER));
    expect(groupRes.status).toBe(200);
    expect(groupRes.body.memberCount).toBe(2);
  });
});
