import { useLocation } from "wouter";
import { useCreateEntry, getListEntriesQueryKey, getGetStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { EntryForm } from "@/components/entry-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveGroup } from "@/components/active-group-context";

export default function AddEntry() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeGroupId } = useActiveGroup();

  const createMutation = useCreateEntry();

  const handleSubmit = (data: any) => {
    createMutation.mutate(
      { data: { ...data, groupId: activeGroupId ?? null } },
      {
        onSuccess: (newEntry) => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          toast({
            title: "Added to watchlist",
            description: `"${newEntry.title}" has been saved.`,
          });
          setLocation("/");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to add entry. Please try again.",
          });
        },
      }
    );
  };

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
        <h1 className="text-xl font-serif font-semibold">New Entry</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-serif font-bold mb-2">Log a Watch</h2>
          <p className="text-muted-foreground">What did you experience today?</p>
        </div>
        
        <EntryForm 
          onSubmit={handleSubmit} 
          isLoading={createMutation.isPending} 
          submitLabel="Add to Library"
        />
      </main>
    </div>
  );
}
