import { Link } from "wouter";
import type { ReactNode } from "react";
import {
  useListActivityFeed,
  getListActivityFeedQueryKey,
  type ActivityItem,
} from "@workspace/api-client-react";
import {
  ChevronLeft,
  Activity as ActivityIcon,
  Star,
  Bookmark,
  MessageCircle,
  Heart,
  Flame,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { StarRating } from "@/components/star-rating";
import { useActiveGroup } from "@/components/active-group-context";

const ICONS: Record<ActivityItem["type"], ReactNode> = {
  rating: <Star className="w-4 h-4" />,
  watchlist: <Bookmark className="w-4 h-4" />,
  comment: <MessageCircle className="w-4 h-4" />,
  approval: <Heart className="w-4 h-4" />,
  spice: <Flame className="w-4 h-4" />,
};

export default function ActivityPage() {
  const { activeGroupId } = useActiveGroup();
  const params = activeGroupId != null ? { groupId: activeGroupId } : undefined;
  const { data: items, isLoading } = useListActivityFeed(params, {
    query: { queryKey: getListActivityFeedQueryKey(params) },
  });

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      <div className="flex items-center gap-2 px-4 pt-6 pb-2 text-foreground">
        <Link
          href="/library"
          className="rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          data-testid="link-back-library"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2.5 font-serif text-2xl sm:text-3xl tracking-[0.18em] text-foreground">
          <ActivityIcon className="w-6 h-6 text-primary shrink-0" />
          ACTIVITY
        </div>
      </div>

      <section className="cinematic-panel text-foreground pt-4 pb-8 px-6 rounded-b-[2.5rem] border-b border-border/60 mb-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-serif tracking-wide text-foreground">
            What's happening
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Recent ratings, saves, comments, and flags from your group.
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
            <ActivityIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-semibold mb-2">
              No activity yet
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              When you or anyone in your group rates, saves, comments on, or
              flags a show, it'll show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="poster-card flex items-start gap-3 bg-card border border-border rounded-2xl p-4"
                data-testid={`activity-${item.id}`}
              >
                <span className="mt-0.5 shrink-0 grid place-items-center w-8 h-8 rounded-full bg-muted/50 text-primary">
                  {ICONS[item.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-foreground">
                    <span className="font-semibold">{item.actorName}</span>{" "}
                    {renderAction(item)}
                  </p>
                  {item.type === "rating" && item.rating != null && (
                    <div className="mt-1.5">
                      <StarRating value={item.rating} readonly size="sm" />
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground font-mono">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ShowTitle({ item }: { item: ActivityItem }) {
  if (item.entryId != null) {
    return (
      <Link
        href={`/entry/${item.entryId}`}
        className="font-semibold text-foreground underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        data-testid={`link-show-${item.id}`}
      >
        {item.title}
      </Link>
    );
  }
  return <span className="font-semibold text-foreground">{item.title}</span>;
}

function renderAction(item: ActivityItem): ReactNode {
  const title = <ShowTitle item={item} />;
  switch (item.type) {
    case "rating":
      return <>rated {title}</>;
    case "watchlist":
      return <>saved {title} to their watchlist</>;
    case "comment":
      return <>commented on {title}</>;
    case "approval":
      if (item.approval === "yes") return <>marked {title} as Wife Approved ✓</>;
      if (item.approval === "no") return <>said {title} isn't Wife Approved</>;
      return <>marked {title} as a solo watch</>;
    case "spice":
      if (item.spicy === "yes") return <>flagged {title} as Spicy 🌶️</>;
      return <>marked {title} as not spicy</>;
    default:
      return title;
  }
}
