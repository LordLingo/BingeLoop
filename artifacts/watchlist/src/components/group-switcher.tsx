import { useState } from "react";
import { Link } from "wouter";
import { Check, ChevronDown, Plus, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveGroup } from "@/components/active-group-context";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { cn } from "@/lib/utils";

export function GroupSwitcher() {
  const { groups, activeGroup, setActiveGroupId } = useActiveGroup();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-9 gap-2 rounded-full border-border/60 bg-card/60 px-3"
            data-testid="button-group-switcher"
          >
            <Users className="h-4 w-4 text-primary" />
            <span className="max-w-[8rem] truncate text-sm font-semibold">
              {activeGroup?.name ?? "Select group"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Your groups</DropdownMenuLabel>
          {groups.map((g) => (
            <DropdownMenuItem
              key={g.id}
              onClick={() => setActiveGroupId(g.id)}
              data-testid={`item-group-${g.id}`}
              className="gap-2"
            >
              <Check
                className={cn(
                  "h-4 w-4",
                  g.id === activeGroup?.id ? "opacity-100 text-primary" : "opacity-0",
                )}
              />
              <span className="flex-1 truncate">{g.name}</span>
              <span className="text-xs text-muted-foreground">
                {g.memberCount}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateOpen(true)}
            data-testid="item-create-group"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create new group
          </DropdownMenuItem>
          <DropdownMenuItem asChild data-testid="item-manage-group" className="gap-2">
            <Link href="/group">
              <Settings className="h-4 w-4" />
              Manage current group
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
