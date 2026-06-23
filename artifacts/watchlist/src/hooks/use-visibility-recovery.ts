import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// iOS (Safari + installed PWA) frequently jettisons a backgrounded web app's
// render process to reclaim memory. When the user returns — e.g. after tapping
// "Watch Trailer", watching on YouTube, then switching back — they can land on
// a blank white screen: the DOM may still exist but is unpainted, or React was
// never re-hydrated. This hook listens for the app becoming visible again and
// recovers automatically so the user never sees the white screen.

// Returning after only a quick app switch shouldn't refresh anything; only act
// once the app was backgrounded long enough that iOS may have purged it.
const HIDDEN_REFRESH_THRESHOLD_MS = 3000;

// The app is considered blank/unhydrated when React isn't mounted into #root.
function appLooksBlank(): boolean {
  const root = document.getElementById("root");
  return !root || root.childElementCount === 0;
}

// Force the compositor to repaint. Recovers WKWebView's "white screen" case
// where the DOM is intact but was never painted after the render process was
// restored. The opacity nudge is sub-perceptible and reverts on the next frame,
// so there is no visible flicker.
function nudgeRepaint(): void {
  const root = document.getElementById("root");
  if (!root) return;
  const previous = root.style.opacity;
  root.style.opacity = "0.999";
  // Read a layout property to force a synchronous reflow before reverting.
  void root.offsetHeight;
  requestAnimationFrame(() => {
    root.style.opacity = previous;
  });
}

export function useVisibilityRecovery(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let hiddenAt: number | null = null;
    let reloading = false;

    const reloadOnce = () => {
      if (reloading) return;
      reloading = true;
      // Reloads the current URL, so the router restores the same screen.
      window.location.reload();
    };

    const recover = () => {
      // If React isn't mounted, only a full reload can bring the app back.
      if (appLooksBlank()) {
        reloadOnce();
        return;
      }
      // Otherwise stay on the current screen: re-fetch active data and nudge a
      // repaint. Smooth, no flicker, no navigation.
      void queryClient.invalidateQueries();
      nudgeRepaint();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      // Becoming visible again.
      const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (appLooksBlank() || hiddenFor >= HIDDEN_REFRESH_THRESHOLD_MS) {
        recover();
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      // Restored from the back/forward cache (common on iOS Safari); the page
      // may be stale or unpainted, so recover.
      if (event.persisted) recover();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [queryClient]);
}
