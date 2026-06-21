import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function ApprovalSummary({
  yes,
  no,
  solo,
  className,
}: {
  yes: number;
  no: number;
  solo: number;
  className?: string;
}) {
  const parts: string[] = [];
  if (yes) parts.push(`${yes} Yes`);
  if (no) parts.push(`${no} No`);
  if (solo) parts.push(`${solo} Solo`);

  if (parts.length === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      data-testid="text-approval-summary"
    >
      <Heart className="h-3.5 w-3.5 text-primary/70" />
      <span className="font-semibold text-foreground/80">Wife approved?</span>
      {parts.join(" / ")}
    </span>
  );
}
