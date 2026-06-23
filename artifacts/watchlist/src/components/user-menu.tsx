import { useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { LogOut, Pencil, ChevronDown, Smartphone } from "lucide-react";
import { useGetProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DisplayNameDialog } from "@/components/display-name-dialog";
import { useInstallHelp } from "@/components/install-prompt";

export function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: profile } = useGetProfile();
  const { open: openInstallHelp, isIphone } = useInstallHelp();
  const [editing, setEditing] = useState(false);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

  if (!user) return null;

  const displayName = profile?.displayName || user.firstName || "Member";

  return (
    <div className="flex items-center gap-1 shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-1.5 px-2 h-9"
            data-testid="button-user-menu"
          >
            <span className="text-sm font-semibold leading-none truncate max-w-[5rem] sm:max-w-[10rem]">
              {displayName}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => setEditing(true)}
            data-testid="menu-edit-display-name"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit display name
          </DropdownMenuItem>
          {isIphone && (
            <DropdownMenuItem
              onSelect={() => openInstallHelp()}
              data-testid="menu-install-help"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Add to Home Screen
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => signOut({ redirectUrl: basePath })}
            data-testid="menu-log-out"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DisplayNameDialog
        open={editing}
        onOpenChange={setEditing}
        initialName={profile?.displayName ?? user.firstName ?? ""}
        title="Edit display name"
      />
    </div>
  );
}
