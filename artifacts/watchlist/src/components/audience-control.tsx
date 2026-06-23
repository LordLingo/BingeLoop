import { useQueryClient } from "@tanstack/react-query";
import {
  useSetAudiences,
  useClearAudiences,
  type ShowAudience,
  type MediaType,
  type Audience,
} from "@workspace/api-client-react";
import { Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useActiveGroup } from "@/components/active-group-context";

const OPTIONS: { value: Audience; label: string }[] = [
  { value: "girls", label: "The Girls" },
  { value: "guys", label: "The Guys" },
  { value: "couples", label: "Couples" },
  { value: "solo", label: "Solo" },
];

export function AudienceControl({
  title,
  mediaType,
  summary,
}: {
  title: string;
  mediaType: MediaType;
  summary?: ShowAudience;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeGroupId } = useActiveGroup();
  const set = useSetAudiences();
  const clear = useClearAudiences();

  const pending = set.isPending || clear.isPending;
  const mine = summary?.myAudiences ?? [];
  const counts: Record<Audience, number> = {
    girls: summary?.girls ?? 0,
    guys: summary?.guys ?? 0,
    couples: summary?.couples ?? 0,
    solo: summary?.solo ?? 0,
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/audiences"] });

  const onError = () =>
    toast({
      variant: "destructive",
      title: "Error",
      description: "Could not save your picks. Please try again.",
    });

  const toggle = (value: Audience) => {
    if (pending) return;
    const next = mine.includes(value)
      ? mine.filter((v) => v !== value)
      : [...mine, value];

    if (next.length === 0) {
      clear.mutate(
        {
          params: {
            title,
            mediaType,
            ...(activeGroupId != null ? { groupId: activeGroupId } : {}),
          },
        },
        { onSuccess: invalidate, onError },
      );
    } else {
      set.mutate(
        {
          data: {
            title,
            mediaType,
            audiences: next,
            ...(activeGroupId != null ? { groupId: activeGroupId } : {}),
          },
        },
        { onSuccess: invalidate, onError },
      );
    }
  };

  const tally = OPTIONS.map((opt) => ({ ...opt, count: counts[opt.value] }))
    .filter((opt) => opt.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-primary" />
        <span className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
          Who Should Watch?
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => {
          const active = mine.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              disabled={pending}
              aria-pressed={active}
              data-testid={`button-audience-${opt.value}`}
              className={cn(
                "rounded-xl border px-3 py-2 text-base font-medium transition-colors disabled:opacity-50",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted/50",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <p
        className="mt-3 text-base text-muted-foreground"
        data-testid="text-audience-tally"
      >
        {tally.length === 0 ? (
          "No picks yet — be the first."
        ) : (
          <>
            {tally.map((opt, i) => (
              <span key={opt.value}>
                {i > 0 && " / "}
                <span className="font-semibold text-foreground">
                  {opt.count} {opt.label}
                </span>
              </span>
            ))}
          </>
        )}
      </p>
    </div>
  );
}
