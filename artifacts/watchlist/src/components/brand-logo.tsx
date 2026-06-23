import { cn } from "@/lib/utils";
import logoUrl from "@/assets/brand-logo.png";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="BingeLoop"
      draggable={false}
      className={cn("h-8 w-auto select-none", className)}
    />
  );
}
