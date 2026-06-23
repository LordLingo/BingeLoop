import { Eye } from "lucide-react";
import type { ShowAudience } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const LABELS: { key: keyof Pick<ShowAudience, "girls" | "guys" | "couples" | "solo">; label: string }[] = [
  { key: "girls", label: "The Girls" },
  { key: "guys", label: "The Guys" },
  { key: "couples", label: "Couples" },
  { key: "solo", label: "Solo" },
];

export function AudienceSummary({
  summary,
  className,
}: {
  summary: ShowAudience;
  className?: string;
}) {
  const tally = LABELS.map((opt) => ({ ...opt, count: summary[opt.key] }))
    .filter((opt) => opt.count > 0)
    .sort((a, b) => b.count - a.count);

  if (tally.length === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      data-testid="text-audience-summary"
    >
      <Eye className="h-3.5 w-3.5 text-primary/70" />
      <span className="font-semibold text-foreground/80">
        {tally.map((opt) => `${opt.count} ${opt.label}`).join(" / ")}
      </span>
    </span>
  );
}
