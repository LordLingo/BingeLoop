import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  useGetEntry,
  getGetEntryQueryKey,
  useDeleteEntry,
  useUpdateEntry,
  getListEntriesQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Edit, Film, Trash2, Tv } from "lucide-react";
import { StarRating } from "@/components/star-rating";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { EntryForm } from "@/components/entry-form";
import { ApprovalControl } from "@/components/approval-control";
import { useApprovalMap, approvalKey } from "@/hooks/use-approvals";
import { SpicyControl } from "@/components/spicy-control";
import { useSpiceMap, spiceKey } from "@/hooks/use-spice";

export default function ViewEntry() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: entry, isLoading, isError } = useGetEntry(id, {
    query: {
      enabled: !!id,
      queryKey: getGetEntryQueryKey(id),
    },
  });

  const deleteMutation = useDeleteEntry();
  const updateMutation = useUpdateEntry();
  const approvalMap = useApprovalMap();
  const spiceMap = useSpiceMap();

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">Could not load this entry.</p>
        <Button onClick={() => setLocation("/")} variant="outline">
          Go back
        </Button>
      </div>
    );
  }

  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          toast({
            title: "Entry deleted",
            description: "The entry has been removed from your watchlist.",
          });
          setLocation("/");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to delete the entry. Please try again.",
          });
        },
      }
    );
  };

  const handleUpdate = (data: any) => {
    updateMutation.mutate(
      { id, data },
      {
        onSuccess: (updatedEntry) => {
          queryClient.setQueryData(getGetEntryQueryKey(id), updatedEntry);
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          setIsEditOpen(false);
          toast({
            title: "Entry updated",
            description: "Your changes have been saved.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update the entry. Please try again.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen pb-20 pt-safe bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          {entry && (
            <>
              <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-edit-entry">
                    <Edit className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto w-full sm:max-w-md">
                  <SheetHeader className="mb-6">
                    <SheetTitle className="font-serif text-2xl">Edit Entry</SheetTitle>
                    <SheetDescription className="sr-only">Make changes to your watchlist entry.</SheetDescription>
                  </SheetHeader>
                  <EntryForm 
                    initialData={entry} 
                    onSubmit={handleUpdate} 
                    isLoading={updateMutation.isPending} 
                    submitLabel="Save Changes"
                  />
                </SheetContent>
              </Sheet>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-destructive"
                    data-testid="button-delete-entry"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove "{entry.title}" from your watchlist.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {isLoading || !entry ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4 rounded-lg" />
            <Skeleton className="h-6 w-1/3 rounded-md" />
            <Skeleton className="h-8 w-48 rounded-md" />
            <Separator />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1 font-medium text-xs tracking-wide uppercase bg-secondary text-secondary-foreground border-none">
                  {entry.category}
                </Badge>
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
                  {entry.mediaType === "movie" ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                  <span className="uppercase tracking-wider">{entry.mediaType}</span>
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight" data-testid="text-title">
                {entry.title}
              </h1>

              <div className="flex items-center gap-4 mt-2">
                <StarRating value={entry.rating} readonly size="lg" />
                <span className="text-base text-muted-foreground font-mono opacity-80 border-l border-border/50 pl-4">
                  {format(new Date(entry.createdAt), "MMM d, yyyy")}
                </span>
                <span className="text-base text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full border border-border/40 font-medium">
                  Logged by {entry.addedBy}
                </span>
              </div>
            </div>

            {entry.comment && (
              <>
                <Separator className="bg-border/60" />
                <div className="prose prose-p:leading-relaxed prose-p:text-foreground/80 max-w-none">
                  <p className="text-base font-semibold tracking-widest uppercase text-muted-foreground mb-3">Thoughts</p>
                  <p className="text-lg leading-loose text-foreground whitespace-pre-wrap" data-testid="text-comment">{entry.comment}</p>
                </div>
              </>
            )}

            <Separator className="bg-border/60" />
            <ApprovalControl
              title={entry.title}
              mediaType={entry.mediaType}
              summary={approvalMap.get(approvalKey(entry.title, entry.mediaType))}
            />
            <SpicyControl
              title={entry.title}
              mediaType={entry.mediaType}
              summary={spiceMap.get(spiceKey(entry.title, entry.mediaType))}
            />
          </div>
        )}
      </main>
    </div>
  );
}
