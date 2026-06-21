import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function SpicySummary({
  yes,
  className,
}: {
  yes: number;
  className?: string;
}) {
  if (!yes) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      data-testid="text-spicy-summary"
    >
      <Flame className="h-3.5 w-3.5 text-primary/70" />
      <span className="font-semibold text-foreground/80">{yes} Spicy 🌶️</span>
    </span>
  );
}
