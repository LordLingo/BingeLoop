import type { MouseEvent } from "react";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function WatchTrailerButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const query = encodeURIComponent(`${title} trailer`);
    window.open(
      `https://www.youtube.com/results?search_query=${query}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Watch trailer for ${title}`}
      title="Watch trailer on YouTube"
      data-testid="button-watch-trailer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50",
        className,
      )}
    >
      <PlayCircle className="h-4 w-4" />
      Watch Trailer
    </button>
  );
}
