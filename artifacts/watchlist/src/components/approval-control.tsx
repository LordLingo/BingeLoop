import { useQueryClient } from "@tanstack/react-query";
import {
  useSetApproval,
  useClearApproval,
  getListApprovalsQueryKey,
  type ShowApproval,
  type MediaType,
  type Approval,
} from "@workspace/api-client-react";
import { Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Approval; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "solo", label: "Solo Watch" },
];

export function ApprovalControl({
  title,
  mediaType,
  summary,
}: {
  title: string;
  mediaType: MediaType;
  summary?: ShowApproval;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const set = useSetApproval();
  const clear = useClearApproval();

  const pending = set.isPending || clear.isPending;
  const my = summary?.myApproval ?? null;
  const counts = {
    yes: summary?.yes ?? 0,
    no: summary?.no ?? 0,
    solo: summary?.solo ?? 0,
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListApprovalsQueryKey() });

  const onError = () =>
    toast({
      variant: "destructive",
      title: "Error",
      description: "Could not save your answer. Please try again.",
    });

  const choose = (value: Approval) => {
    if (pending) return;
    if (my === value) {
      clear.mutate(
        { params: { title, mediaType } },
        { onSuccess: invalidate, onError },
      );
    } else {
      set.mutate(
        { data: { title, mediaType, approval: value } },
        { onSuccess: invalidate, onError },
      );
    }
  };

  const total = counts.yes + counts.no + counts.solo;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Heart className="h-4 w-4 text-primary" />
        <span className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
          Wife Approved?
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
              data-testid={`button-approval-${opt.value}`}
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

      <p className="mt-3 text-base text-muted-foreground" data-testid="text-approval-tally">
        {total === 0 ? (
          "No answers yet — be the first."
        ) : (
          <>
            <span className="font-semibold text-foreground">{counts.yes} Yes</span>
            {" / "}
            <span className="font-semibold text-foreground">{counts.no} No</span>
            {counts.solo > 0 && (
              <>
                {" / "}
                <span className="font-semibold text-foreground">
                  {counts.solo} Solo
                </span>
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
