const TMDB_BASE = "https://api.themoviedb.org/3";

export interface TmdbSearchHit {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string | null;
  posterPath: string | null;
}

export interface TmdbDetailsResult {
  streamingProvider: string | null;
  streamingLogo: string | null;
  network: string | null;
}

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not configured");
  return key;
}

function yearFrom(date: unknown): string | null {
  if (typeof date === "string" && date.length >= 4) return date.slice(0, 4);
  return null;
}

interface TmdbMultiResult {
  id: number;
  media_type: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
}

export async function searchMulti(query: string): Promise<TmdbSearchHit[]> {
  const url = `${TMDB_BASE}/search/multi?api_key=${apiKey()}&query=${encodeURIComponent(
    query,
  )}&include_adult=false`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`TMDB search failed: ${resp.status}`);
  const data = (await resp.json()) as { results?: TmdbMultiResult[] };
  const results = data.results ?? [];
  return results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => ({
      tmdbId: r.id,
      mediaType: r.media_type as "movie" | "tv",
      title: (r.title ?? r.name ?? "").trim(),
      year: yearFrom(r.media_type === "movie" ? r.release_date : r.first_air_date),
      posterPath: r.poster_path ?? null,
    }))
    .filter((r) => r.title.length > 0);
}

interface ProviderEntry {
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
}

async function fetchStreaming(
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<{ provider: string | null; logo: string | null }> {
  const url = `${TMDB_BASE}/${mediaType}/${tmdbId}/watch/providers?api_key=${apiKey()}`;
  const resp = await fetch(url);
  if (!resp.ok) return { provider: null, logo: null };
  const data = (await resp.json()) as {
    results?: { US?: { flatrate?: ProviderEntry[] } };
  };
  const flatrate = data.results?.US?.flatrate ?? [];
  if (flatrate.length === 0) return { provider: null, logo: null };
  const best = [...flatrate].sort(
    (a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999),
  )[0];
  return { provider: best.provider_name, logo: best.logo_path ?? null };
}

async function fetchNetwork(tmdbId: number): Promise<string | null> {
  const url = `${TMDB_BASE}/tv/${tmdbId}?api_key=${apiKey()}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    networks?: { name: string }[];
  };
  return data.networks?.[0]?.name ?? null;
}

export async function getDetails(
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<TmdbDetailsResult> {
  const [{ provider, logo }, network] = await Promise.all([
    fetchStreaming(mediaType, tmdbId),
    mediaType === "tv" ? fetchNetwork(tmdbId) : Promise.resolve(null),
  ]);
  return {
    streamingProvider: provider,
    streamingLogo: logo,
    network,
  };
}
