import { useQueryClient } from "@tanstack/react-query";
import {
  useToggleReaction,
  type ReactionSummary,
  type ReactionEmoji,
  type ReactionTargetType,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useActiveGroup } from "@/components/active-group-context";

const EMOJIS: ReactionEmoji[] = ["👍", "❤️", "😂", "😮", "🔥"];

export function ReactionBar({
  targetType,
  targetId,
  summary,
  size = "md",
}: {
  targetType: ReactionTargetType;
  targetId: number;
  summary?: ReactionSummary;
  size?: "sm" | "md";
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeGroupId } = useActiveGroup();
  const toggle = useToggleReaction();

  const mine = new Set(summary?.mine ?? []);
  const countByEmoji = new Map(
    (summary?.emojis ?? []).map((e) => [e.emoji, e.count]),
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/reactions"] });

  const onError = () =>
    toast({
      variant: "destructive",
      title: "Error",
      description: "Could not save your reaction. Please try again.",
    });

  const react = (emoji: ReactionEmoji) => {
    if (toggle.isPending) return;
    toggle.mutate(
      {
        data: {
          targetType,
          targetId,
          emoji,
          ...(activeGroupId != null ? { groupId: activeGroupId } : {}),
        },
      },
      { onSuccess: invalidate, onError },
    );
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {EMOJIS.map((emoji) => {
        const count = countByEmoji.get(emoji) ?? 0;
        const active = mine.has(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              react(emoji);
            }}
            disabled={toggle.isPending}
            aria-pressed={active}
            data-testid={`button-reaction-${targetType}-${targetId}-${emoji}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border transition-colors disabled:opacity-50",
              size === "sm" ? "px-2 py-0.5 text-sm" : "px-2.5 py-1 text-base",
              active
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50",
            )}
          >
            <span className="leading-none">{emoji}</span>
            {count > 0 && (
              <span className="text-xs font-semibold tabular-nums">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
