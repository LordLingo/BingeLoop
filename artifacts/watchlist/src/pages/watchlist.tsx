import { Link } from "wouter";
import {
  useListWatchlist,
  getListWatchlistQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Film, Tv, Bookmark, Users } from "lucide-react";
import { format } from "date-fns";
import { SaveToWatchlistButton } from "@/components/save-to-watchlist-button";
import { ApprovalSummary } from "@/components/approval-summary";
import { useApprovalMap, approvalKey } from "@/hooks/use-approvals";
import { useActiveGroup } from "@/components/active-group-context";

export default function WatchlistPage() {
  const { activeGroupId } = useActiveGroup();
  const watchlistParams =
    activeGroupId != null ? { groupId: activeGroupId } : undefined;
  const { data: items, isLoading } = useListWatchlist(watchlistParams, {
    query: { queryKey: getListWatchlistQueryKey(watchlistParams) },
  });
  const approvalMap = useApprovalMap();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex items-center gap-2 px-4 pt-6 pb-2 text-foreground">
        <Link
          href="/library"
          className="rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          data-testid="link-back-library"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2.5 font-serif text-2xl sm:text-3xl tracking-[0.18em] text-foreground">
          <Bookmark className="w-6 h-6 text-primary shrink-0" />
          MY WATCHLIST
        </div>
      </div>

      <section className="cinematic-panel text-foreground pt-4 pb-8 px-6 rounded-b-[2.5rem] border-b border-border/60 mb-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-serif tracking-wide text-foreground">
            Saved to watch
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Shows you've bookmarked, with the group members who've also rated or
            saved them.
          </p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading...
          </div>
        ) : !items || items.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-border border-dashed">
            <Bookmark className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-semibold mb-2">
              Nothing saved yet
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Tap "Save" on any show in the library to add it to your personal
              watchlist.
            </p>
            <Link href="/library">
              <Button variant="outline" className="rounded-full">
                Browse the library
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="poster-card flex flex-col bg-card border border-border rounded-2xl p-5"
                data-testid={`card-watchlist-${item.id}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    {item.mediaType === "movie" ? (
                      <Film className="w-4 h-4" />
                    ) : (
                      <Tv className="w-4 h-4" />
                    )}
                    {item.mediaType === "movie" ? "Movie" : "TV"}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(item.createdAt), "MMM d")}
                  </span>
                </div>

                <h3 className="text-2xl font-serif tracking-wide mb-4 line-clamp-2">
                  {item.title}
                </h3>

                <div className="mt-auto space-y-3">
                  {item.alsoEngagedBy.length > 0 ? (
                    <div className="flex items-start gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-2">
                      <Users className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Also rated or saved by{" "}
                        <span className="font-semibold text-foreground">
                          {formatNames(item.alsoEngagedBy)}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic px-1">
                      No one else in your group has this yet.
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <SaveToWatchlistButton
                      title={item.title}
                      mediaType={item.mediaType}
                      savedItemId={item.id}
                    />
                    {(() => {
                      const a = approvalMap.get(
                        approvalKey(item.title, item.mediaType),
                      );
                      return a ? (
                        <ApprovalSummary yes={a.yes} no={a.no} solo={a.solo} />
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function formatNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
