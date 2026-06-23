import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEntries,
  useUpdateEntry,
  getListEntriesQueryKey,
  getGetStatsQueryKey,
  type Entry,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Film, Tv, FolderInput } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useActiveGroup } from "@/components/active-group-context";

const UNASSIGNED_PARAMS = { unassigned: true };

export default function AssignEntries() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { groups, activeGroupId } = useActiveGroup();

  const { data: entries, isLoading } = useListEntries(UNASSIGNED_PARAMS, {
    query: { queryKey: getListEntriesQueryKey(UNASSIGNED_PARAMS) },
  });

  const updateMutation = useUpdateEntry();

  const [selections, setSelections] = useState<Record<number, number>>({});

  const defaultGroupId = (entryId: number): number | undefined =>
    selections[entryId] ?? activeGroupId ?? groups[0]?.id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  };

  const assign = (entry: Entry, groupId: number | undefined) => {
    if (groupId == null) return;
    updateMutation.mutate(
      { id: entry.id, data: { groupId } },
      {
        onSuccess: () => {
          invalidate();
          const groupName = groups.find((g) => g.id === groupId)?.name ?? "group";
          toast({
            title: "Assigned",
            description: `"${entry.title}" was added to ${groupName}.`,
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Could not assign this show. Please try again.",
          });
        },
      },
    );
  };

  const assignAll = () => {
    const targetId = activeGroupId ?? groups[0]?.id;
    if (targetId == null || !entries) return;
    for (const entry of entries) {
      const gid = selections[entry.id] ?? targetId;
      updateMutation.mutate(
        { id: entry.id, data: { groupId: gid } },
        { onSuccess: invalidate },
      );
    }
    toast({
      title: "Assigning shows",
      description: "Your unassigned shows are being placed into their groups.",
    });
  };

  const hasGroups = groups.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20 pt-safe">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full mr-2"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-serif font-semibold">Assign Shows</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <h2 className="text-3xl font-serif font-bold">Place your shows</h2>
          <p className="text-muted-foreground">
            These shows aren't in any group yet. Pick the group each one belongs
            to so it shows up in the right library.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-border border-dashed">
            <FolderInput className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-semibold mb-2">All set</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              You don't have any unassigned shows. Everything is already in a
              group.
            </p>
            <Button className="mt-6 rounded-full" onClick={() => setLocation("/")}>
              Back to library
            </Button>
          </div>
        ) : (
          <>
            {!hasGroups ? (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                You need to be in a group before you can assign shows. Create or
                join a group first.
              </div>
            ) : (
              entries.length > 1 && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <span className="text-sm text-muted-foreground">
                    {entries.length} shows waiting
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={assignAll}
                    disabled={updateMutation.isPending}
                    data-testid="button-assign-all"
                  >
                    Assign all to current group
                  </Button>
                </div>
              )
            )}

            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  data-testid={`unassigned-entry-${entry.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 text-muted-foreground">
                      {entry.mediaType === "movie" ? (
                        <Film className="w-5 h-5" />
                      ) : (
                        <Tv className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif text-lg truncate">{entry.title}</p>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {entry.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={
                        defaultGroupId(entry.id) != null
                          ? String(defaultGroupId(entry.id))
                          : undefined
                      }
                      onValueChange={(v) =>
                        setSelections((s) => ({ ...s, [entry.id]: Number(v) }))
                      }
                      disabled={!hasGroups}
                    >
                      <SelectTrigger
                        className="h-10 w-40"
                        data-testid={`select-group-${entry.id}`}
                      >
                        <SelectValue placeholder="Pick a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => assign(entry, defaultGroupId(entry.id))}
                      disabled={
                        !hasGroups ||
                        updateMutation.isPending ||
                        defaultGroupId(entry.id) == null
                      }
                      data-testid={`button-assign-${entry.id}`}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
