import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Film, Tv, Star, Popcorn, Clapperboard, Disc3 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

// Faint perforated film-strip pattern: two columns of sprocket holes hugging
// each edge of the strip, over a barely-there band. Alpha is baked into the
// colors so the pattern stays crisp without an opacity wrapper.
const filmStripStyle = {
  backgroundColor: "hsl(var(--foreground) / 0.035)",
  backgroundImage:
    "repeating-linear-gradient(to bottom, hsl(var(--foreground) / 0.16) 0 9px, transparent 9px 21px)," +
    "repeating-linear-gradient(to bottom, hsl(var(--foreground) / 0.16) 0 9px, transparent 9px 21px)",
  backgroundRepeat: "repeat-y, repeat-y",
  backgroundSize: "6px 21px, 6px 21px",
  backgroundPosition: "left 5px top, right 5px top",
};

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-background flex flex-col font-sans overflow-x-hidden">
      {/* Decorative cinema accents — purely behind the content, never interactive */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* Film-strip frames down both edges (narrowed + faded on mobile) */}
        <div
          className="absolute inset-y-0 left-0 w-5 sm:w-10 md:w-12 opacity-50 sm:opacity-100"
          style={filmStripStyle}
        />
        <div
          className="absolute inset-y-0 right-0 w-5 sm:w-10 md:w-12 opacity-50 sm:opacity-100"
          style={filmStripStyle}
        />

        {/* Warm gold spotlight glow behind the heading */}
        <div
          className="absolute left-1/2 top-[30%] sm:top-[34%] -translate-x-1/2 -translate-y-1/2 w-[44rem] h-[26rem] max-w-[92vw] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--primary) / 0.20), hsl(var(--primary) / 0.06) 58%, transparent 76%)",
          }}
        />

        {/* Scattered reels + stars: very low opacity texture, trimmed on small screens */}
        <Disc3 className="hidden md:block absolute top-24 right-[12%] w-28 h-28 text-foreground/[0.05] rotate-12" />
        <Disc3 className="hidden md:block absolute bottom-28 left-[14%] w-24 h-24 text-foreground/[0.04] -rotate-6" />
        <Film className="hidden sm:block absolute top-[58%] right-[8%] w-16 h-16 text-foreground/[0.045] -rotate-12" />
        <Star className="absolute top-[14%] left-[22%] w-7 h-7 text-primary/[0.14]" />
        <Star className="absolute top-[42%] right-[24%] w-5 h-5 text-primary/[0.16]" />
        <Star className="hidden sm:block absolute bottom-[32%] left-[30%] w-6 h-6 text-foreground/[0.07]" />

        {/* Cinema icons tucked into the margins/corners (small, muted gold / soft gray) */}
        <Disc3 className="hidden sm:block absolute top-28 left-4 md:left-16 w-9 h-9 text-foreground/[0.12] rotate-6" />
        <Clapperboard className="absolute bottom-8 left-7 sm:left-16 w-8 h-8 sm:w-10 sm:h-10 text-primary/25 -rotate-6" />
        <Popcorn className="absolute bottom-8 right-7 sm:right-16 w-8 h-8 sm:w-10 sm:h-10 text-primary/25" />
      </div>

      <header className="relative z-10 px-6 py-6 flex items-center justify-between">
        <BrandLogo className="h-9" />
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="font-medium">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="rounded-full font-medium px-6 shadow-md hover:shadow-lg transition-all">Sign Up</Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 py-12 text-center z-10">
          <Badge className="mb-6 mx-auto bg-secondary/50 text-foreground border border-border/50 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold tracking-widest uppercase">
            A shared cinematic journal
          </Badge>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-bold tracking-tight leading-[1.1] mb-8 text-foreground">
            Log your <span className="text-foreground italic">film & TV</span><br />
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
