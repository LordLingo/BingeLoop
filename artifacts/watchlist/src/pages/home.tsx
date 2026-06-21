import { useState } from "react";
import { Link } from "wouter";
import { 
  useListEntries, 
  useGetStats, 
  useListCategories, 
  getListEntriesQueryKey,
  ListEntriesSort
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Film, Tv, Star, ArrowUpDown } from "lucide-react";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Home() {
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [filterType, setFilterType] = useState<"movie" | "tv" | undefined>(undefined);
  const [sort, setSort] = useState<ListEntriesSort>("newest");

  const { data: stats } = useGetStats();
  const { data: categories } = useListCategories();
  
  const { data: entries, isLoading } = useListEntries({
    category: filterCategory,
    mediaType: filterType,
    sort,
  }, {
    query: {
      queryKey: getListEntriesQueryKey({ category: filterCategory, mediaType: filterType, sort })
    }
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Stats */}
      <section className="bg-primary text-primary-foreground pt-12 pb-8 px-6 rounded-b-[2.5rem] shadow-sm mb-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl font-serif font-bold tracking-tight">Your Library</h1>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-black/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <div className="text-3xl font-serif font-semibold">{stats?.total || 0}</div>
              <div className="text-sm text-primary-foreground/80 font-medium">Logged</div>
            </div>
            <div className="bg-black/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <div className="text-3xl font-serif font-semibold flex items-center gap-2">
                {stats?.averageRating ? Number(stats.averageRating).toFixed(1) : "-"}
                <Star className="w-5 h-5 fill-accent text-accent" />
              </div>
              <div className="text-sm text-primary-foreground/80 font-medium">Avg Rating</div>
            </div>
            <div className="bg-black/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <div className="flex gap-3 h-full items-center">
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-xl font-semibold flex items-center gap-1.5">
                    <Film className="w-4 h-4 opacity-70" /> {stats?.movieCount || 0}
                  </div>
                  <div className="text-xl font-semibold flex items-center gap-1.5">
                    <Tv className="w-4 h-4 opacity-70" /> {stats?.tvCount || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <ScrollArea className="w-full whitespace-nowrap pb-2 -mb-2">
            <div className="flex gap-2 w-max">
              <Button 
                variant={!filterCategory && !filterType ? "secondary" : "outline"} 
                className="rounded-full"
                onClick={() => { setFilterCategory(undefined); setFilterType(undefined); }}
                size="sm"
              >
                All
              </Button>
              <Button 
                variant={filterType === "movie" ? "secondary" : "outline"} 
                className="rounded-full"
                onClick={() => { setFilterType(filterType === "movie" ? undefined : "movie"); setFilterCategory(undefined); }}
                size="sm"
              >
                <Film className="w-4 h-4 mr-1.5" /> Movies
              </Button>
              <Button 
                variant={filterType === "tv" ? "secondary" : "outline"} 
                className="rounded-full"
                onClick={() => { setFilterType(filterType === "tv" ? undefined : "tv"); setFilterCategory(undefined); }}
                size="sm"
              >
                <Tv className="w-4 h-4 mr-1.5" /> TV Shows
              </Button>
              
              <div className="w-px h-6 bg-border mx-1 self-center" />
              
              {categories?.map(cat => (
                <Button 
                  key={cat}
                  variant={filterCategory === cat ? "secondary" : "outline"} 
                  className="rounded-full"
                  onClick={() => setFilterCategory(filterCategory === cat ? undefined : cat)}
                  size="sm"
                >
                  {cat}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full shrink-0">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as ListEntriesSort)}>
                <DropdownMenuRadioItem value="newest">Newest First</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest First</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="rating_high">Highest Rated</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="rating_low">Lowest Rated</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="title">Title (A-Z)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Entries List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-border border-dashed">
              <Film className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-serif font-semibold mb-2">Nothing found</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                No entries match your current filters, or you haven't added anything yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {entries.map(entry => (
                <Link 
                  key={entry.id} 
                  href={`/entry/${entry.id}`}
                  className="group flex flex-col bg-card hover:bg-muted/30 transition-colors border border-border rounded-2xl p-5 shadow-sm hover:shadow-md"
                  data-testid={`card-entry-${entry.id}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="outline" className="bg-background text-xs uppercase tracking-wider font-semibold">
                      {entry.category}
                    </Badge>
                    <div className="text-muted-foreground">
                      {entry.mediaType === "movie" ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-serif font-bold mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                    {entry.title}
                  </h3>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <StarRating value={entry.rating} readonly size="sm" />
                    <span className="text-xs text-muted-foreground font-mono">
                      {format(new Date(entry.createdAt), "MMM d")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FAB for Adding */}
      <Link href="/add" className="fixed bottom-6 right-6 z-20 group" data-testid="button-add-entry">
        <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full shadow-lg group-hover:shadow-xl group-hover:scale-105 active:scale-95 transition-all flex items-center justify-center">
          <Plus className="w-8 h-8" />
        </div>
      </Link>
    </div>
  );
}
