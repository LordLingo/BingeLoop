import { Tv } from "lucide-react";

interface StreamingBadgeProps {
  streamingProvider?: string | null;
  streamingLogo?: string | null;
  network?: string | null;
}

export function StreamingBadge({
  streamingProvider,
  streamingLogo,
  network,
}: StreamingBadgeProps) {
  if (streamingProvider) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/50"
        data-testid="badge-streaming"
      >
        {streamingLogo ? (
          <img
            src={`https://image.tmdb.org/t/p/w92${streamingLogo}`}
            alt={streamingProvider}
            className="w-4 h-4 rounded-sm object-contain"
          />
        ) : (
          <Tv className="w-3.5 h-3.5" />
        )}
        {streamingProvider}
      </span>
    );
  }

  if (network) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/50"
        data-testid="badge-network"
      >
        <Tv className="w-3.5 h-3.5" />
        {network}
      </span>
    );
  }

  return null;
}
