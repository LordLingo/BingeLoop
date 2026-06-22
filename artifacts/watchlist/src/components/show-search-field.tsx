import { useEffect, useRef, useState } from "react";
import { useTmdbSearch, tmdbDetails, getTmdbSearchQueryKey } from "@workspace/api-client-react";
import type { TmdbSearchResult } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Film, Tv, Search, X, Loader2 } from "lucide-react";

export interface SelectedShow {
  title: string;
  mediaType: "movie" | "tv";
  tmdbId?: number;
  posterPath?: string | null;
  streamingProvider?: string | null;
  streamingLogo?: string | null;
  network?: string | null;
}

interface ShowSearchFieldProps {
  value: SelectedShow | null;
  onChange: (show: SelectedShow | null) => void;
}

function PosterThumb({
  posterPath,
  mediaType,
  size = "sm",
}: {
  posterPath?: string | null;
  mediaType: "movie" | "tv";
  size?: "sm" | "lg";
}) {
  const dims = size === "lg" ? "w-16 h-24" : "w-10 h-14";
  if (posterPath) {
    return (
      <img
        src={`https://image.tmdb.org/t/p/w154${posterPath}`}
        alt=""
        className={`${dims} rounded-md object-cover bg-muted shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dims} rounded-md bg-muted flex items-center justify-center shrink-0`}
    >
      {mediaType === "movie" ? (
        <Film className="w-5 h-5 text-muted-foreground" />
      ) : (
        <Tv className="w-5 h-5 text-muted-foreground" />
      )}
    </div>
  );
}

export function ShowSearchField({ value, onChange }: ShowSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const selectionToken = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useTmdbSearch(
    { query: debounced },
    {
      query: {
        enabled: debounced.length > 0 && open,
        queryKey: getTmdbSearchQueryKey({ query: debounced }),
      },
    },
  );

  const handleSelect = async (hit: TmdbSearchResult) => {
    setOpen(false);
    setQuery("");
    setDebounced("");
    const token = ++selectionToken.current;
    const base: SelectedShow = {
      title: hit.title,
      mediaType: hit.mediaType,
      tmdbId: hit.tmdbId,
      posterPath: hit.posterPath ?? null,
      streamingProvider: null,
      streamingLogo: null,
      network: null,
    };
    onChange(base);
    setResolving(true);
    try {
      const details = await tmdbDetails({
        tmdbId: hit.tmdbId,
        mediaType: hit.mediaType,
      });
      // Ignore a stale response if the user changed/cleared the selection
      // while this details request was in flight.
      if (token !== selectionToken.current) return;
      onChange({
        ...base,
        streamingProvider: details.streamingProvider ?? null,
        streamingLogo: details.streamingLogo ?? null,
        network: details.network ?? null,
      });
    } catch {
      // streaming info is best-effort; keep the selected show
    } finally {
      if (token === selectionToken.current) setResolving(false);
    }
  };

  if (value) {
    return (
      <div
        className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
        data-testid="selected-show"
      >
        <PosterThumb
          posterPath={value.posterPath}
          mediaType={value.mediaType}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="font-serif text-lg tracking-wide line-clamp-2">
            {value.title}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            {value.mediaType === "movie" ? (
              <Film className="w-4 h-4" />
            ) : (
              <Tv className="w-4 h-4" />
            )}
            <span className="capitalize">
              {value.mediaType === "tv" ? "TV Show" : "Movie"}
            </span>
            {resolving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {!resolving && value.streamingProvider && (
              <span>· {value.streamingProvider}</span>
            )}
            {!resolving && !value.streamingProvider && value.network && (
              <span>· {value.network}</span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full shrink-0"
          onClick={() => {
            selectionToken.current++;
            setResolving(false);
            onChange(null);
          }}
          data-testid="button-change-show"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search for a movie or show..."
          className="h-12 text-lg pl-10"
          data-testid="input-title"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {open && debounced.length > 0 && (
        <div className="absolute z-30 mt-2 w-full max-h-80 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
          {!results || results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {isFetching ? "Searching..." : "No results found"}
            </div>
          ) : (
            results.map((hit) => (
              <button
                key={`${hit.mediaType}-${hit.tmdbId}`}
                type="button"
                onClick={() => handleSelect(hit)}
                className="flex items-center gap-3 w-full text-left p-2.5 hover:bg-muted/60 transition-colors"
                data-testid={`search-result-${hit.tmdbId}`}
              >
                <PosterThumb
                  posterPath={hit.posterPath}
                  mediaType={hit.mediaType}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{hit.title}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    {hit.mediaType === "movie" ? (
                      <Film className="w-3 h-3" />
                    ) : (
                      <Tv className="w-3 h-3" />
                    )}
                    <span>{hit.mediaType === "tv" ? "TV" : "Movie"}</span>
                    {hit.year && <span>· {hit.year}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
