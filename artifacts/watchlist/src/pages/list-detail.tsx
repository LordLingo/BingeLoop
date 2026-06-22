import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  useGetList,
  getGetListQueryKey,
  useUpdateList,
  useDeleteList,
  useAddListItem,
  useDeleteListItem,
  getListListsQueryKey,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  Film,
  Tv,
  User,
  Pencil,
  Plus,
  Trash2,
  ListVideo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useActiveGroup } from "@/components/active-group-context";

type MediaType = "movie" | "tv";

export default function ListDetailPage() {
  const params = useParams();
  const listId = Number(params.id);
  const { user } = useUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { activeGroupId } = useActiveGroup();

  const { data: list, isLoading } = useGetList(listId, {
    query: {
      enabled: Number.isFinite(listId),
      queryKey: getGetListQueryKey(listId),
    },
  });

  const updateList = useUpdateList();
  const deleteList = useDeleteList();
  const addItem = useAddListItem();
  const deleteItem = useDeleteListItem();

  const isOwner = !!user && !!list && user.id === list.ownerId;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newMediaType, setNewMediaType] = useState<MediaType>("movie");

  useEffect(() => {
    setEditing(false);
  }, [listId]);

  const browseParams =
    activeGroupId != null ? { groupId: activeGroupId } : undefined;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetListQueryKey(listId) });
    qc.invalidateQueries({ queryKey: getListListsQueryKey(browseParams) });
  };

  const openEdit = () => {
    setName(list?.name ?? "");
    setDescription(list?.description ?? "");
    setEditing(true);
  };

  const saveEdit = () => {
    const trimmed = name.trim();
    if (!trimmed || updateList.isPending) return;
    updateList.mutate(
      {
        id: listId,
        data: { name: trimmed, description: description.trim() || null },
      },
      {
        onSuccess: () => {
          invalidate();
          setEditing(false);
          toast({ title: "List updated" });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't save changes",
            description: "Please try again.",
          }),
      },
    );
  };

  const addNewItem = () => {
    const trimmed = newTitle.trim();
    if (!trimmed || addItem.isPending) return;
    addItem.mutate(
      { id: listId, data: { title: trimmed, mediaType: newMediaType } },
      {
        onSuccess: () => {
          invalidate();
          setNewTitle("");
          setNewMediaType("movie");
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't add that title",
            description: "Please try again.",
          }),
      },
    );
  };

  const removeItem = (itemId: number) => {
    deleteItem.mutate(
      { id: listId, itemId },
      {
        onSuccess: invalidate,
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't remove that title",
            description: "Please try again.",
          }),
      },
    );
  };

  const handleDeleteList = () => {
    deleteList.mutate(
      { id: listId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListListsQueryKey(browseParams) });
          toast({ title: "List deleted" });
          setLocation("/lists");
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't delete the list",
            description: "Please try again.",
          }),
      },
    );
  };

  if (!isLoading && !list) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-muted-foreground px-4 text-center">
        <ListVideo className="w-12 h-12 text-muted-foreground/30" />
        <p>This list isn't available, or you don't have access to it.</p>
        <Link href="/lists">
          <Button variant="outline" className="rounded-full">
            Back to lists
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      <div className="flex items-center gap-2 px-4 pt-6 pb-2 text-foreground">
        <Link
          href="/lists"
          className="rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          data-testid="link-back-lists"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2.5 font-serif text-2xl sm:text-3xl tracking-[0.18em] text-foreground">
          <ListVideo className="w-6 h-6 text-primary shrink-0" />
          LIST
        </div>
      </div>

      <section className="cinematic-panel text-foreground pt-4 pb-8 px-6 rounded-b-[2.5rem] border-b border-border/60 mb-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1
              className="text-5xl font-serif tracking-wide text-foreground"
              data-testid="text-list-name"
            >
              {list?.name ?? "…"}
            </h1>
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground hover:text-primary shrink-0"
                onClick={openEdit}
                data-testid="button-edit-list"
              >
                <Pencil className="w-5 h-5" />
              </Button>
            )}
          </div>
          {list?.description ? (
            <p className="text-muted-foreground max-w-prose">
              {list.description}
            </p>
          ) : null}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            Created by{" "}
            <span className="font-semibold text-foreground">
              {list?.ownerName}
            </span>
          </div>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 space-y-6">
        {isOwner && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Add a movie or show
            </h2>
            <div className="flex items-center gap-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNewItem();
                }}
                placeholder="Type any title"
                maxLength={200}
                className="flex-1"
                data-testid="input-add-item"
              />
              <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setNewMediaType("movie")}
                  className={cn(
                    "px-2.5 py-2 transition-colors",
                    newMediaType === "movie"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                  aria-label="Movie"
                  aria-pressed={newMediaType === "movie"}
                  data-testid="button-item-movie"
                >
                  <Film className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setNewMediaType("tv")}
                  className={cn(
                    "px-2.5 py-2 transition-colors border-l border-border",
                    newMediaType === "tv"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                  aria-label="TV Show"
                  aria-pressed={newMediaType === "tv"}
                  data-testid="button-item-tv"
                >
                  <Tv className="w-4 h-4" />
                </button>
              </div>
              <Button
                onClick={addNewItem}
                disabled={addItem.isPending || !newTitle.trim()}
                className="shrink-0"
                data-testid="button-add-item"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading...
          </div>
        ) : !list || list.items.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-border border-dashed">
            <ListVideo className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-semibold mb-2">
              Nothing in this list yet
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {isOwner
                ? "Add your first movie or show above."
                : "The creator hasn't added any titles yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {list.items.map((item) => (
              <div
                key={item.id}
                className="poster-card flex items-center justify-between gap-3 bg-card border border-border rounded-2xl p-5"
                data-testid={`card-item-${item.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-muted-foreground shrink-0">
                    {item.mediaType === "movie" ? (
                      <Film className="w-5 h-5" />
                    ) : (
                      <Tv className="w-5 h-5" />
                    )}
                  </div>
                  <h3 className="text-xl font-serif tracking-wide line-clamp-2">
                    {item.title}
                  </h3>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Remove"
                    data-testid={`button-remove-item-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isOwner && (
          <div className="pt-4 border-t border-border/60">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                  data-testid="button-delete-list"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete this list
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{list?.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the list and everything in it. This
                    can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteList}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete list
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </main>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif tracking-wide">
              Edit list
            </DialogTitle>
            <DialogDescription>
              Update the title or description of your list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="List name"
              maxLength={120}
              autoFocus
              data-testid="input-edit-list-name"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              maxLength={500}
              rows={3}
              data-testid="input-edit-list-description"
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(false)}
              data-testid="button-cancel-edit-list"
            >
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={updateList.isPending || !name.trim()}
              data-testid="button-save-edit-list"
            >
              {updateList.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
