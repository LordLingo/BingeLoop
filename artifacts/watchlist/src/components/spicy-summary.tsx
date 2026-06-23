import { cn } from "@/lib/utils";

export function SpicySummary({
  mild,
  mature,
  adult,
  className,
}: {
  mild: number;
  mature: number;
  adult: number;
  className?: string;
}) {
  const total = mild + mature + adult;
  if (!total) return null;

  const avg = (mild * 1 + mature * 2 + adult * 3) / total;
  const level = Math.min(3, Math.max(1, Math.round(avg)));
  const peppers = "🌶️".repeat(level);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      data-testid="text-spicy-summary"
    >
      <span aria-hidden>{peppers}</span>
      <span className="font-semibold text-foreground/80">
        {total} {total === 1 ? "rating" : "ratings"}
      </span>
    </span>
  );
}
