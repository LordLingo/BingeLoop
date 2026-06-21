import { useNewActivity } from "@/components/new-activity-context";
import { Sparkles, X } from "lucide-react";

export function NewActivityBadge() {
  const { count, dismissed, dismiss } = useNewActivity();

  if (dismissed || count <= 0) return null;

  return (
    <div
      className="flex items-center gap-3 bg-accent/15 border border-accent/30 text-foreground rounded-2xl px-4 py-3"
      data-testid="banner-new-activity"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/25">
        <Sparkles className="h-5 w-5 text-accent-foreground" />
      </div>
      <p className="flex-1 text-sm font-medium">
        <span className="font-semibold">{count}</span>{" "}
        {count === 1 ? "show was" : "shows were"} added by your group since your
        last visit.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
        aria-label="Dismiss"
        data-testid="button-dismiss-activity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
