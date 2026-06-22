import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTopFour,
  getListTopFourQueryKey,
  useSetTopFour,
} from "@workspace/api-client-react";
import type { TopFourPick } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Film, Tv, Star, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type MediaType = "movie" | "tv";

interface DraftPick {
  title: string;
  mediaType: MediaType;
}

const SLOTS = [0, 1, 2, 3];

interface TopFourSectionProps {
  userId: string;
  isSelf: boolean;
  displayName: string;
}

export function TopFourSection({
  userId,
  isSelf,
  displayName,
}: TopFourSectionProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: picks } = useListTopFour(
    { userId },
    { query: { queryKey: getListTopFourQueryKey({ userId }) } },
  );

  const setTopFour = useSetTopFour();

  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<DraftPick[]>([]);

  const ordered: (TopFourPick | null)[] = SLOTS.map(
    (slot) => picks?.find((p) => p.position === slot) ?? null,
  );

  const hasAny = (picks?.length ?? 0) > 0;

  const openEdit = () => {
    setDrafts(
      SLOTS.map((slot) => {
        const existing = picks?.find((p) => p.position === slot);
        return {
          title: existing?.title ?? "",
          mediaType: (existing?.mediaType as MediaType) ?? "movie",
        };
      }),
    );
    setEditing(true);
  };

  const updateDraft = (index: number, patch: Partial<DraftPick>) => {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  };

  const save = () => {
    const payload = drafts
      .map((d) => ({ title: d.title.trim(), mediaType: d.mediaType }))
      .filter((d) => d.title.length > 0);

    setTopFour.mutate(
      { data: { picks: payload } },
      {
        onSuccess: () => {
          qc.invalidateQueries({
            queryKey: getListTopFourQueryKey({ userId }),
          });
          setEditing(false);
          toast({ title: "Top Four updated" });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't save your Top Four",
            description: "Please try again.",
          }),
      },
    );
  };

  // Hide the section entirely for other members who haven't set any picks.
  if (!isSelf && !hasAny) return null;

  return (
    <section className="space-y-4" data-testid="section-top-four">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <Star className="w-5 h-5 fill-primary text-primary" />
          <h2 className="text-2xl font-serif tracking-wide">Top Four</h2>
        </div>
        {isSelf && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-muted-foreground hover:text-primary"
            onClick={openEdit}
            data-testid="button-edit-top-four"
          >
            <Pencil className="w-4 h-4 mr-1.5" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ordered.map((pick, i) =>
          pick ? (
            <div
              key={i}
              className="poster-card flex flex-col justify-between aspect-[2/3] rounded-2xl border border-border p-4"
              data-testid={`top-four-slot-${i}`}
            >
              <div className="flex justify-between items-start">
                <span className="font-serif text-3xl text-primary/80 leading-none">
                  {i + 1}
                </span>
                <div className="text-muted-foreground">
                  {pick.mediaType === "movie" ? (
                    <Film className="w-4 h-4" />
                  ) : (
                    <Tv className="w-4 h-4" />
                  )}
                </div>
              </div>
              <h3 className="font-serif text-xl tracking-wide line-clamp-4">
                {pick.title}
              </h3>
            </div>
          ) : (
            <div
              key={i}
              className={cn(
                "flex flex-col justify-between aspect-[2/3] rounded-2xl border border-dashed border-border p-4",
                isSelf
                  ? "cursor-pointer hover:border-primary/50 transition-colors"
                  : "",
              )}
              onClick={isSelf ? openEdit : undefined}
              data-testid={`top-four-slot-${i}`}
            >
              <span className="font-serif text-3xl text-muted-foreground/30 leading-none">
                {i + 1}
              </span>
              <span className="text-xs text-muted-foreground/60">
                {isSelf ? "Add a favorite" : "Empty"}
              </span>
            </div>
          ),
        )}
      </div>

      {isSelf && !hasAny && (
        <p className="text-sm text-muted-foreground">
          Pick up to four all-time favorite movies or shows to feature on your
          profile.
        </p>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif tracking-wide">
              Edit {isSelf ? "your" : `${displayName}'s`} Top Four
            </DialogTitle>
            <DialogDescription>
              List up to four all-time favorites. Leave a slot blank to skip it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {drafts.map((draft, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-serif text-2xl text-primary/70 w-6 shrink-0 text-center">
                  {i + 1}
                </span>
                <Input
                  value={draft.title}
                  onChange={(e) => updateDraft(i, { title: e.target.value })}
                  placeholder="Title"
                  maxLength={200}
                  className="flex-1"
                  data-testid={`input-top-four-title-${i}`}
                />
                <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => updateDraft(i, { mediaType: "movie" })}
                    className={cn(
                      "px-2.5 py-2 transition-colors",
                      draft.mediaType === "movie"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                    aria-label="Movie"
                    aria-pressed={draft.mediaType === "movie"}
                    data-testid={`button-top-four-movie-${i}`}
                  >
                    <Film className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDraft(i, { mediaType: "tv" })}
                    className={cn(
                      "px-2.5 py-2 transition-colors border-l border-border",
                      draft.mediaType === "tv"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                    aria-label="TV Show"
                    aria-pressed={draft.mediaType === "tv"}
                    data-testid={`button-top-four-tv-${i}`}
                  >
                    <Tv className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(false)}
              data-testid="button-cancel-top-four"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={setTopFour.isPending}
              data-testid="button-save-top-four"
            >
              {setTopFour.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
