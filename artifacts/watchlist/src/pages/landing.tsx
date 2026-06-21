import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Film, Tv, Star, Library } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 text-primary font-serif font-bold text-2xl tracking-tight">
          <Library className="w-6 h-6" />
          Watchlist
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="font-medium">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="rounded-full font-medium px-6 shadow-md hover:shadow-lg transition-all">Sign Up</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 py-12 text-center z-10">
          <Badge className="mb-6 mx-auto bg-secondary/50 text-foreground border border-border/50 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold tracking-widest uppercase">
            A shared cinematic journal
          </Badge>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-bold tracking-tight leading-[1.1] mb-8 text-foreground">
            Log your <span className="text-primary italic">film & TV</span><br />
            with your friend group.
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            A beautifully crafted editorial space to record what you've watched, rate it, and share thoughts—all in one shared group library.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all w-full sm:w-auto bg-primary text-primary-foreground">
                Start Logging
              </Button>
            </Link>
          </div>
          
          <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-3xl mx-auto">
            <div className="bg-card/50 backdrop-blur-md border border-border/50 p-6 rounded-3xl shadow-sm">
              <Film className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-serif font-bold text-xl mb-2">Movies</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">Keep track of the films you experience and see what your friends thought.</p>
            </div>
            <div className="bg-card/50 backdrop-blur-md border border-border/50 p-6 rounded-3xl shadow-sm">
              <Tv className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-serif font-bold text-xl mb-2">TV Shows</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">Log entire seasons or series in your shared collection.</p>
            </div>
            <div className="bg-card/50 backdrop-blur-md border border-border/50 p-6 rounded-3xl shadow-sm">
              <Star className="w-8 h-8 text-accent mb-4" />
              <h3 className="font-serif font-bold text-xl mb-2">Ratings</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">Rate and review. See who added what and build a unified library.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";