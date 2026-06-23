import { useQueryClient } from "@tanstack/react-query";
import {
  useSetSpicy,
  useClearSpicy,
  type ShowSpicy,
  type MediaType,
  type Spicy,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useActiveGroup } from "@/components/active-group-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const OPTIONS: {
  value: Spicy;
  label: string;
  peppers: string;
  barClass: string;
}[] = [
  { value: "mild", label: "Mild", peppers: "🌶️", barClass: "bg-emerald-500" },
  { value: "mature", label: "17+", peppers: "🌶️🌶️", barClass: "bg-amber-500" },
  {
    value: "adult",
    label: "Adults Only",
    peppers: "🌶️🌶️🌶️",
    barClass: "bg-rose-500",
  },
];

export function SpicyControl({
  title,
  mediaType,
  summary,
}: {
  title: string;
  mediaType: MediaType;
  summary?: ShowSpicy;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeGroupId } = useActiveGroup();
  const set = useSetSpicy();
  const clear = useClearSpicy();

  const pending = set.isPending || clear.isPending;
  const my = summary?.mySpicy ?? null;
  const total =
    (summary?.mild ?? 0) + (summary?.mature ?? 0) + (summary?.adult ?? 0);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/spice"] });

  const onError = () =>
    toast({
      variant: "destructive",
      title: "Error",
      description: "Could not save your answer. Please try again.",
    });

  const choose = (value: Spicy) => {
    if (pending) return;
    if (my === value) {
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
            spicy: value,
            ...(activeGroupId != null ? { groupId: activeGroupId } : {}),
          },
        },
        { onSuccess: invalidate, onError },
      );
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
          Spicy?
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const active = my === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => choose(opt.value)}
              disabled={pending}
              aria-pressed={active}
              data-testid={`button-spicy-${opt.value}`}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm font-medium transition-colors disabled:opacity-50",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted/50",
              )}
            >
              <span className="text-lg leading-none">{opt.peppers}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {total > 0 && (
        <div className="mt-3">
          <TooltipProvider delayDuration={100}>
            <div
              className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
              data-testid="spicy-distribution"
            >
              {OPTIONS.map((opt) => {
                const count = summary?.[opt.value] ?? 0;
                if (count === 0) return null;
                const pct = (count / total) * 100;
                return (
                  <Tooltip key={opt.value}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn("h-full", opt.barClass)}
                        style={{ width: `${pct}%` }}
                        data-testid={`spicy-bar-${opt.value}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {opt.label}: {count} {count === 1 ? "vote" : "votes"}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
          <p className="mt-2 text-xs text-muted-foreground">
            {total} {total === 1 ? "vote" : "votes"} from your group
          </p>
        </div>
      )}
    </div>
  );
}
