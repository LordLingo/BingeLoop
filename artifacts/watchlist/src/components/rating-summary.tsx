import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingSummaryProps {
  averageRating: number | null;
  ratingCount: number;
  className?: string;
}

export function RatingSummary({
  averageRating,
  ratingCount,
  className,
}: RatingSummaryProps) {
  if (averageRating == null || ratingCount === 0) {
    return (
      <span
        className={cn("text-sm text-muted-foreground/70 italic", className)}
        data-testid="rating-summary-empty"
      >
        Not rated yet
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-sm font-medium text-foreground",
        className,
      )}
      data-testid="rating-summary"
    >
      <Star className="w-4 h-4 fill-accent text-accent shrink-0" />
      <span className="font-semibold">{averageRating.toFixed(1)}</span>
      <span className="text-muted-foreground">avg</span>
      <span className="text-muted-foreground/50">·</span>
      <span className="text-muted-foreground">
        {ratingCount} {ratingCount === 1 ? "rating" : "ratings"}
      </span>
    </div>
  );
}
