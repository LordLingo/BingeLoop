import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLists,
  getListListsQueryKey,
  useCreateList,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ListVideo, Plus, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveGroup } from "@/components/active-group-context";

export default function ListsPage() {
  const { activeGroupId } = useActiveGroup();
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = activeGroupId != null ? { groupId: activeGroupId } : undefined;
  const { data: lists, isLoading } = useListLists(params, {
    query: { queryKey: getListListsQueryKey(params) },
  });

  const createList = useCreateList();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const openCreate = () => {
    setName("");
    setDescription("");
    setOpen(true);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || createList.isPending) return;
    createList.mutate(
      {
        data: {
          name: trimmed,
          description: description.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListListsQueryKey(params) });
          setOpen(false);
          toast({ title: "List created" });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't create the list",
            description: "Please try again.",
          }),
      },
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-6 pb-2 text-foreground">
        <div className="flex items-center gap-2">
          <Link
            href="/library"
            className="rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            data-testid="link-back-library"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5 font-serif text-2xl sm:text-3xl tracking-[0.18em] text-foreground">
            <ListVideo className="w-6 h-6 text-primary shrink-0" />
            LISTS
          </div>
        </div>
        <Button
          onClick={openCreate}
          size="sm"
          className="rounded-full shrink-0"
          data-testid="button-new-list"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New list
        </Button>
      </div>

      <section className="cinematic-panel text-foreground pt-4 pb-8 px-6 rounded-b-[2.5rem] border-b border-border/60 mb-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-serif tracking-wide text-foreground">
            Curated lists
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Themed collections from everyone in your group. Open any list to see
            what's inside — only the creator can change their own.
          </p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading...
          </div>
        ) : !lists || lists.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-border border-dashed">
            <ListVideo className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-semibold mb-2">
              No lists yet
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Create the first one — "Guys Night Picks", "Wife Made Me Watch
              It", anything goes.
            </p>
            <Button
              onClick={openCreate}
              variant="outline"
              className="rounded-full"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New list
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="poster-card group flex flex-col bg-card hover:bg-muted/30 transition-all border border-border rounded-2xl p-5"
                data-testid={`card-list-${list.id}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    <ListVideo className="w-4 h-4" />
                    {list.itemCount} {list.itemCount === 1 ? "title" : "titles"}
                  </div>
                </div>

                <h3 className="text-2xl font-serif tracking-wide mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {list.name}
                </h3>

                {list.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {list.description}
                  </p>
                ) : null}

                <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  by{" "}
                  <span className="font-semibold text-foreground">
                    {list.ownerName}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif tracking-wide">
              New list
            </DialogTitle>
            <DialogDescription>
              Give it a title and an optional description. You can add titles
              after creating it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="List name (e.g. Guys Night Picks)"
              maxLength={120}
              autoFocus
              data-testid="input-list-name"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              maxLength={500}
              rows={3}
              data-testid="input-list-description"
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              data-testid="button-cancel-list"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={createList.isPending || !name.trim()}
              data-testid="button-save-list"
            >
              {createList.isPending ? "Creating…" : "Create list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
