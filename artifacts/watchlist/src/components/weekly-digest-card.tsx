import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetWeeklyDigest,
  getGetWeeklyDigestQueryKey,
} from "@workspace/api-client-react";
import { Sparkles, X, Star, MessageCircle, Bookmark } from "lucide-react";
import { useActiveGroup } from "@/components/active-group-context";

// One dismissal per ISO-week so the card returns each new week.
function weekKey(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

export function WeeklyDigestCard() {
  const { activeGroupId } = useActiveGroup();
  const dismissKey = `digest-dismissed-${activeGroupId ?? "self"}-${weekKey()}`;
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(dismissKey) === "1",
  );

  // Re-sync from localStorage whenever the key changes (group switch or new
  // ISO-week), so a dismissal in one group/week doesn't leak across to another.
  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  const params = activeGroupId != null ? { groupId: activeGroupId } : undefined;
  const { data } = useGetWeeklyDigest(params, {
    query: { queryKey: getGetWeeklyDigestQueryKey(params) },
  });

  if (dismissed || !data) return null;

  const total = data.newRatings + data.newComments + data.newSaves;
  if (total === 0) return null;

  const dismiss = () => {
    localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  return (
    <div
      className="poster-card relative rounded-2xl border border-border p-5"
      data-testid="card-weekly-digest"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss digest"
        data-testid="button-dismiss-digest"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
          This Week
        </span>
      </div>

      <div className="flex flex-wrap gap-4 text-foreground">
        <span className="inline-flex items-center gap-1.5 text-base">
          <Star className="w-4 h-4 text-primary" />
          <span className="font-semibold tabular-nums">{data.newRatings}</span>
          <span className="text-muted-foreground">new {data.newRatings === 1 ? "rating" : "ratings"}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-base">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="font-semibold tabular-nums">{data.newComments}</span>
          <span className="text-muted-foreground">{data.newComments === 1 ? "comment" : "comments"}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-base">
          <Bookmark className="w-4 h-4 text-primary" />
          <span className="font-semibold tabular-nums">{data.newSaves}</span>
          <span className="text-muted-foreground">{data.newSaves === 1 ? "save" : "saves"}</span>
        </span>
      </div>

      {data.topShow && (
        <p className="mt-3 text-base text-foreground" data-testid="text-digest-top-show">
          Top pick:{" "}
          {data.topShow.entryId != null ? (
            <Link
              href={`/entry/${data.topShow.entryId}`}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              {data.topShow.title}
            </Link>
          ) : (
            <span className="font-semibold">{data.topShow.title}</span>
          )}{" "}
          <span className="text-muted-foreground">
            ({data.topShow.rating}★ by {data.topShow.addedBy})
          </span>
        </p>
      )}

      {data.mostActive && (
        <p className="mt-1 text-base text-muted-foreground" data-testid="text-digest-most-active">
          Most active:{" "}
          <span className="font-semibold text-foreground">{data.mostActive.name}</span>{" "}
          ({data.mostActive.count} {data.mostActive.count === 1 ? "action" : "actions"})
        </p>
      )}
    </div>
  );
}
