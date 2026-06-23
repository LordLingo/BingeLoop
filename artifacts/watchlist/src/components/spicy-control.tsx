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

const OPTIONS: { value: Spicy; label: string; peppers: string }[] = [
  { value: "mild", label: "Mild", peppers: "🌶️" },
  { value: "mature", label: "17+", peppers: "🌶️🌶️" },
  { value: "adult", label: "Adults Only", peppers: "🌶️🌶️🌶️" },
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
    </div>
  );
}
