import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListEntries, 
  useGetStats, 
  useListCategories, 
  useListWatchlist,
  getListEntriesQueryKey,
  getListWatchlistQueryKey,
  ListEntriesSort
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Film, Tv, Star, ArrowUpDown, Bookmark, Activity, ListVideo } from "lucide-react";
import { SaveToWatchlistButton } from "@/components/save-to-watchlist-button";
import { WatchTrailerButton } from "@/components/watch-trailer-button";
import { StreamingBadge } from "@/components/streaming-badge";
import { ApprovalSummary } from "@/components/approval-summary";
import { useApprovalMap, approvalKey } from "@/hooks/use-approvals";
import { SpicySummary } from "@/components/spicy-summary";
import { useSpiceMap, spiceKey } from "@/hooks/use-spice";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { UserMenu } from "@/components/user-menu";
import { NewActivityBadge } from "@/components/new-activity-badge";
import { InviteDialog } from "@/components/invite-dialog";
import { GroupSwitcher } from "@/components/group-switcher";
import { useActiveGroup } from "@/components/active-group-context";

export default function Home() {
  const [, navigate] = useLocation();
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [filterType, setFilterType] = useState<"movie" | "tv" | undefined>(undefined);
  const [sort, setSort] = useState<ListEntriesSort>("newest");

  const { activeGroupId } = useActiveGroup();

  const { data: stats } = useGetStats(
    activeGroupId != null ? { groupId: activeGroupId } : undefined,
  );
  const { data: categories } = useListCategories();
  const watchlistParams =
    activeGroupId != null ? { groupId: activeGroupId } : undefined;
  const { data: watchlist } = useListWatchlist(watchlistParams, {
    query: { queryKey: getListWatchlistQueryKey(watchlistParams) },
  });

  const savedIdByShow = new Map<string, number>();
  for (const item of watchlist ?? []) {
    savedIdByShow.set(`${item.title.trim().toLowerCase()}::${item.mediaType}`, item.id);
  }

  const approvalMap = useApprovalMap();
  const spiceMap = useSpiceMap();
  
  const entriesParams = {
    ...(activeGroupId != null ? { groupId: activeGroupId } : {}),
    category: filterCategory,
    mediaType: filterType,
    sort,
  };
  const { data: entries, isLoading } = useListEntries(entriesParams, {
    query: {
      queryKey: getListEntriesQueryKey(entriesParams),
    },
  });

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      <div className="flex flex-col gap-3 px-4 sm:px-6 pt-6 pb-2 text-foreground">
        <div className="flex items-center gap-2.5 font-serif text-2xl sm:text-3xl tracking-[0.18em] text-foreground">
          <Film className="w-6 h-6 text-primary shrink-0" />
          BINGELOOP
        </div>
        <div className="flex items-center justify-between gap-2">
          <GroupSwitcher />
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href="/activity"
              className="flex items-center gap-1.5 rounded-full px-2 sm:px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
              data-testid="link-activity"
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Activity</span>
            </Link>
            <Link
              href="/lists"
              className="flex items-center gap-1.5 rounded-full px-2 sm:px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
              data-testid="link-lists"
            >
              <ListVideo className="w-4 h-4" />
              <span className="hidden sm:inline">Lists</span>
            </Link>
            <Link
              href="/watchlist"
              className="flex items-center gap-1.5 rounded-full px-2 sm:px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
              data-testid="link-my-watchlist"
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">My Watchlist</span>
            </Link>
            <InviteDialog />
            <UserMenu />
          </div>
        </div>
      </div>
      {/* Hero Stats */}
      <section className="cinematic-panel text-foreground pt-6 pb-8 px-6 rounded-b-[2.5rem] border-b border-border/60 mb-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-serif tracking-wide text-foreground">Your Library</h1>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-black/[0.03] rounded-2xl p-4 border border-black/10">
              <div className="text-4xl font-serif text-foreground">{stats?.total || 0}</div>
              <div className="text-sm text-muted-foreground font-medium tracking-wide uppercase">Logged</div>
            </div>
            <div className="bg-black/[0.03] rounded-2xl p-4 border border-black/10">
              <div className="text-4xl font-serif flex items-center gap-2 text-foreground">
                {stats?.averageRating ? Number(stats.averageRating).toFixed(1) : "-"}
                <Star className="w-5 h-5 fill-accent text-accent" />
              </div>
              <div className="text-sm text-muted-foreground font-medium tracking-wide uppercase">Avg Rating</div>
            </div>
            <div className="bg-black/[0.03] rounded-2xl p-4 border border-black/10">
              <div className="flex gap-3 h-full items-center">
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-xl font-semibold flex items-center gap-1.5 text-foreground">
                    <Film className="w-4 h-4 text-primary/70" /> {stats?.movieCount || 0}
                  </div>
                  <div className="text-xl font-semibold flex items-center gap-1.5 text-foreground">
                    <Tv className="w-4 h-4 text-primary/70" /> {stats?.tvCount || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 space-y-6">
        <NewActivityBadge />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <ScrollArea className="w-full min-w-0 max-w-full whitespace-nowrap pb-2 -mb-2">
            <div className="flex gap-2 w-max">
              <Button 
                variant={!filterCategory && !filterType ? "secondary" : "outline"} 
                className="rounded-full"
                onClick={() => { setFilterCategory(undefined); setFilterType(undefined); }}
                size="sm"
              >
                All
              </Button>
              <Button 
                variant={filterType === "movie" ? "secondary" : "outline"} 
                className="rounded-full"
                onClick={() => { setFilterType(filterType === "movie" ? undefined : "movie"); setFilterCategory(undefined); }}
                size="sm"
              >
                <Film className="w-4 h-4 mr-1.5" /> Movies
              </Button>
              <Button 
                variant={filterType === "tv" ? "secondary" : "outline"} 
                className="rounded-full"
                onClick={() => { setFilterType(filterType === "tv" ? undefined : "tv"); setFilterCategory(undefined); }}
                size="sm"
              >
                <Tv className="w-4 h-4 mr-1.5" /> TV Shows
              </Button>
              
              <div className="w-px h-6 bg-border mx-1 self-center" />
              
              {categories?.map(cat => (
                <Button 
                  key={cat}
                  variant={filterCategory === cat ? "secondary" : "outline"} 
                  className="rounded-full"
                  onClick={() => setFilterCategory(filterCategory === cat ? undefined : cat)}
                  size="sm"
                >
                  {cat}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full shrink-0">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as ListEntriesSort)}>
                <DropdownMenuRadioItem value="newest">Newest First</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest First</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="rating_high">Highest Rated</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="rating_low">Lowest Rated</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="title">Title (A-Z)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Entries List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-border border-dashed">
              <Film className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-serif font-semibold mb-2">Nothing found</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                No entries match your current filters, or you haven't added anything yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {entries.map(entry => (
                <Link 
                  key={entry.id} 
                  href={`/entry/${entry.id}`}
                  className="poster-card group flex bg-card hover:bg-muted/30 transition-all border border-border rounded-2xl overflow-hidden"
                  data-testid={`card-entry-${entry.id}`}
                >
                  <div className="w-[38%] shrink-0 self-stretch relative bg-muted/40">
                    {entry.posterPath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${entry.posterPath}`}
                        alt={entry.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                        data-testid={`poster-entry-${entry.id}`}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                        {entry.mediaType === "movie" ? (
                          <Film className="w-10 h-10" />
                        ) : (
                          <Tv className="w-10 h-10" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col p-5">
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="outline" className="bg-background text-xs uppercase tracking-wider font-semibold">
                      {entry.category}
                    </Badge>
                    <div className="text-muted-foreground">
                      {entry.mediaType === "movie" ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-serif tracking-wide mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                    {entry.title}
                  </h3>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StarRating value={entry.rating} readonly size="sm" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/member/${entry.addedById}`);
                        }}
                        className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`link-added-by-${entry.id}`}
                      >
                        Added by{" "}
                        <span className="text-primary font-semibold underline-offset-2 hover:underline">
                          {entry.addedBy}
                        </span>
                      </button>
                    </div>
                  </div>

                  {(entry.streamingProvider || entry.network) && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <StreamingBadge
                        streamingProvider={entry.streamingProvider}
                        streamingLogo={entry.streamingLogo}
                        network={entry.network}
                      />
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
                    <SaveToWatchlistButton
                      title={entry.title}
                      mediaType={entry.mediaType}
                      savedItemId={savedIdByShow.get(
                        `${entry.title.trim().toLowerCase()}::${entry.mediaType}`,
                      )}
                    />
                    <WatchTrailerButton title={entry.title} />
                    {(() => {
                      const a = approvalMap.get(approvalKey(entry.title, entry.mediaType));
                      return a ? (
                        <ApprovalSummary yes={a.yes} no={a.no} solo={a.solo} />
                      ) : null;
                    })()}
                    {(() => {
                      const s = spiceMap.get(spiceKey(entry.title, entry.mediaType));
                      return s ? <SpicySummary yes={s.yes} /> : null;
                    })()}
                  </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FAB for Adding */}
      <Link href="/add" className="fixed bottom-6 right-6 z-20 group" data-testid="button-add-entry">
        <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full shadow-lg group-hover:shadow-xl group-hover:scale-105 active:scale-95 transition-all flex items-center justify-center">
          <Plus className="w-8 h-8" />
        </div>
      </Link>
    </div>
  );
}
