import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { db, entriesTable } from "@workspace/db";
import { makeTestApp } from "./testApp";

const app = makeTestApp();

const RUN = `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}_alice`;

function as(userId: string) {
  return { "x-test-user-id": userId };
}

const ORIGINAL_KEY = process.env.TMDB_API_KEY;

beforeAll(() => {
  process.env.TMDB_API_KEY = "test-key";
});

afterAll(async () => {
  if (ORIGINAL_KEY === undefined) delete process.env.TMDB_API_KEY;
  else process.env.TMDB_API_KEY = ORIGINAL_KEY;
  await db.delete(entriesTable).where(inArray(entriesTable.userId, [ALICE]));
});

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
  } as unknown as Response;
}

describe("GET /api/tmdb/search", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/tmdb/search?query=inception");
    expect(res.status).toBe(401);
  });

  it("returns movie/tv hits and filters out people", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchOnce({
        results: [
          {
            id: 27205,
            media_type: "movie",
            title: "Inception",
            release_date: "2010-07-16",
            poster_path: "/poster.jpg",
          },
          {
            id: 1399,
            media_type: "tv",
            name: "Game of Thrones",
            first_air_date: "2011-04-17",
            poster_path: "/got.jpg",
          },
          { id: 99, media_type: "person", name: "Some Actor" },
        ],
      }),
    );

    const res = await request(app)
      .get("/api/tmdb/search?query=inception")
      .set(as(ALICE));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      tmdbId: 27205,
      mediaType: "movie",
      title: "Inception",
      year: "2010",
      posterPath: "/poster.jpg",
    });
    expect(res.body[1]).toMatchObject({
      tmdbId: 1399,
      mediaType: "tv",
      title: "Game of Thrones",
      year: "2011",
    });
  });

  it("400s on an empty query", async () => {
    const res = await request(app).get("/api/tmdb/search?query=").set(as(ALICE));
    expect(res.status).toBe(400);
  });

  it("400s when query is omitted (does not call TMDB)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await request(app).get("/api/tmdb/search").set(as(ALICE));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("502s when TMDB fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchOnce({}, false, 500),
    );
    const res = await request(app)
      .get("/api/tmdb/search?query=boom")
      .set(as(ALICE));
    expect(res.status).toBe(502);
  });
});

describe("GET /api/tmdb/details", () => {
  it("returns US flatrate provider for a movie", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchOnce({
        results: {
          US: {
            flatrate: [
              {
                provider_name: "Netflix",
                logo_path: "/netflix.jpg",
                display_priority: 1,
              },
              {
                provider_name: "Hulu",
                logo_path: "/hulu.jpg",
                display_priority: 3,
              },
            ],
          },
        },
      }),
    );

    const res = await request(app)
      .get("/api/tmdb/details?tmdbId=27205&mediaType=movie")
      .set(as(ALICE));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      streamingProvider: "Netflix",
      streamingLogo: "/netflix.jpg",
      network: null,
    });
  });

  it("returns provider and network for a tv show", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // watch/providers call
    fetchSpy.mockResolvedValueOnce(
      mockFetchOnce({
        results: { US: { flatrate: [{ provider_name: "Max", logo_path: "/max.jpg" }] } },
      }),
    );
    // tv details call
    fetchSpy.mockResolvedValueOnce(
      mockFetchOnce({ networks: [{ name: "HBO" }] }),
    );

    const res = await request(app)
      .get("/api/tmdb/details?tmdbId=1399&mediaType=tv")
      .set(as(ALICE));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      streamingProvider: "Max",
      network: "HBO",
    });
  });

  it("returns nulls (not 500) when TMDB lookups fail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockFetchOnce({}, false, 404),
    );
    const res = await request(app)
      .get("/api/tmdb/details?tmdbId=1&mediaType=movie")
      .set(as(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      streamingProvider: null,
      network: null,
    });
  });
});

describe("POST /api/entries persists TMDB fields", () => {
  it("stores tmdbId, posterPath, streaming and network", async () => {
    const res = await request(app)
      .post("/api/entries")
      .set(as(ALICE))
      .send({
        title: "Inception",
        mediaType: "movie",
        rating: 5,
        category: "Sci-Fi",
        tmdbId: 27205,
        posterPath: "/poster.jpg",
        streamingProvider: "Netflix",
        streamingLogo: "/netflix.jpg",
        network: null,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Inception",
      tmdbId: 27205,
      posterPath: "/poster.jpg",
      streamingProvider: "Netflix",
      streamingLogo: "/netflix.jpg",
    });
  });
});
