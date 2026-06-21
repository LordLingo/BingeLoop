import { useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex flex-col items-end min-w-0">
        <span className="text-sm font-semibold leading-none truncate max-w-[4.5rem] sm:max-w-[10rem]">{user.firstName || user.emailAddresses[0]?.emailAddress?.split("@")[0]}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => signOut({ redirectUrl: basePath })}
        title="Log out"
      >
        <LogOut className="w-4 h-4" />
        <span className="sr-only">Log out</span>
      </Button>
    </div>
  );
}
