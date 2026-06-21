import { useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-end">
        <span className="text-sm font-semibold leading-none">{user.firstName || user.emailAddresses[0]?.emailAddress?.split("@")[0]}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => signOut({ redirectUrl: basePath })}
        title="Log out"
      >
        <LogOut className="w-4 h-4" />
        <span className="sr-only">Log out</span>
      </Button>
    </div>
  );
}
