import type { MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateWatchlistItem,
  useDeleteWatchlistItem,
  getListWatchlistQueryKey,
  type MediaType,
} from "@workspace/api-client-react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function SaveToWatchlistButton({
  title,
  mediaType,
  savedItemId,
  className,
}: {
  title: string;
  mediaType: MediaType;
  savedItemId?: number;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const create = useCreateWatchlistItem();
  const remove = useDeleteWatchlistItem();

  const saved = savedItemId !== undefined;
  const pending = create.isPending || remove.isPending;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListWatchlistQueryKey() });

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    if (saved) {
      remove.mutate(
        { id: savedItemId! },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Removed from your watchlist" });
          },
          onError: () =>
            toast({
              variant: "destructive",
              title: "Error",
              description: "Could not update your watchlist. Please try again.",
            }),
        },
      );
    } else {
      create.mutate(
        { data: { title, mediaType } },
        {
          onSuccess: () => {
            invalidate();
          },
          onError: () =>
            toast({
              variant: "destructive",
              title: "Error",
              description: "Could not update your watchlist. Please try again.",
            }),
        },
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
      title={saved ? "Saved to your watchlist" : "Save to your watchlist"}
      data-testid={`button-save-watchlist-${mediaType}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
        saved
          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50",
        className,
      )}
    >
      {saved ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
