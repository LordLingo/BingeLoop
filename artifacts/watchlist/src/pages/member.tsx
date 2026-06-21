import { Link, useParams } from "wouter";
import {
  useListEntries,
  getListEntriesQueryKey,
  useGetStats,
  getGetStatsQueryKey,
  useGetGroup,
  getGetGroupQueryKey,
} from "@workspace/api-client-react";
import { ChevronLeft, Film, Tv, Star, User } from "lucide-react";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useActiveGroup } from "@/components/active-group-context";

export default function MemberPage() {
  const params = useParams();
  const userId = params.userId ?? "";
  const { activeGroupId } = useActiveGroup();

  const { data: group } = useGetGroup(activeGroupId ?? 0, {
    query: {
      enabled: activeGroupId != null,
      queryKey: getGetGroupQueryKey(activeGroupId ?? 0),
    },
  });

  const displayName =
    group?.members.find((m) => m.userId === userId)?.displayName ?? "Member";

  const { data: stats } = useGetStats(
    { userId },
    { query: { queryKey: getGetStatsQueryKey({ userId }) } },
  );

  const { data: entries, isLoading } = useListEntries(
    { userId, sort: "newest" },
    { query: { queryKey: getListEntriesQueryKey({ userId, sort: "newest" }) } },
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex items-center gap-2 px-4 pt-6 pb-2 text-foreground">
        <Link
          href="/group"
          className="rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          data-testid="link-back-group"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2.5 font-serif text-2xl sm:text-3xl tracking-[0.18em] text-primary">
          <User className="w-6 h-6 text-primary shrink-0" />
          MEMBER
        </div>
      </div>

      <section className="cinematic-panel text-foreground pt-4 pb-8 px-6 rounded-b-[2.5rem] border-b border-border/60 mb-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1
            className="text-5xl font-serif tracking-wide text-foreground"
            data-testid="text-member-name"
          >
            {displayName}
          </h1>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/[0.03] rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <div className="text-4xl font-serif text-primary">
                {stats?.total || 0}
              </div>
              <div className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
                Logged
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <div className="text-4xl font-serif flex items-center gap-2 text-foreground">
                {stats?.averageRating
                  ? Number(stats.averageRating).toFixed(1)
                  : "-"}
                <Star className="w-5 h-5 fill-accent text-accent" />
              </div>
              <div className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
                Avg Rating
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <div className="flex gap-3 h-full items-center">
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-xl font-semibold flex items-center gap-1.5 text-foreground">
                    <Film className="w-4 h-4 text-primary/70" />{" "}
                    {stats?.movieCount || 0}
                  </div>
                  <div className="text-xl font-semibold flex items-center gap-1.5 text-foreground">
                    <Tv className="w-4 h-4 text-primary/70" />{" "}
                    {stats?.tvCount || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : !entries || entries.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-border border-dashed">
            <Film className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-semibold mb-2">
              Nothing logged yet
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {displayName} hasn't added any shows to share.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/entry/${entry.id}`}
                className="poster-card group flex flex-col bg-card hover:bg-muted/30 transition-all border border-border rounded-2xl p-5"
                data-testid={`card-entry-${entry.id}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <Badge
                    variant="outline"
                    className="bg-background text-xs uppercase tracking-wider font-semibold"
                  >
                    {entry.category}
                  </Badge>
                  <div className="text-muted-foreground">
                    {entry.mediaType === "movie" ? (
                      <Film className="w-4 h-4" />
                    ) : (
                      <Tv className="w-4 h-4" />
                    )}
                  </div>
                </div>

                <h3 className="text-2xl font-serif tracking-wide mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                  {entry.title}
                </h3>

                <div className="mt-auto flex items-center justify-between">
                  <StarRating value={entry.rating} readonly size="sm" />
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(entry.createdAt), "MMM d")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
