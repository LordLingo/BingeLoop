import { useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { useGetGroup, getGetGroupQueryKey } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Crown, ChevronRight } from "lucide-react";
import { useActiveGroup } from "@/components/active-group-context";

export function GroupMembersDialog() {
  const { activeGroupId, activeGroup } = useActiveGroup();
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  const { data: group, isLoading } = useGetGroup(activeGroupId ?? 0, {
    query: {
      enabled: activeGroupId != null,
      queryKey: getGetGroupQueryKey(activeGroupId ?? 0),
    },
  });

  const members = group?.members ?? [];
  // Prefer the freshly-fetched count; fall back to the list-groups count so the
  // pill shows a number immediately while getGroup is still loading.
  const count = group?.memberCount ?? activeGroup?.memberCount ?? 0;

  if (activeGroupId == null) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-black/[0.06]"
          data-testid="button-group-members"
        >
          <Users className="w-4 h-4 text-primary" />
          <span>
            {count} {count === 1 ? "member" : "members"}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>
            Everyone in {activeGroup ? `"${activeGroup.name}"` : "this group"}.
            Tap a name to see their shows.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-1 px-1">
          <div className="space-y-2 py-1">
            {members.length === 0 && (
              <p
                className="px-1 py-2 text-sm text-muted-foreground"
                data-testid="text-members-empty"
              >
                {isLoading ? "Loading members…" : "No members to show."}
              </p>
            )}
            {members.map((m) => {
              const isSelf = m.userId === user?.id;
              return (
                <Link
                  key={m.userId}
                  href={`/member/${m.userId}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  data-testid={`dialog-member-${m.userId}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">
                      {m.displayName}
                    </span>
                    {isSelf && (
                      <span className="text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                    {m.role === "owner" && (
                      <Crown className="w-4 h-4 shrink-0 text-primary" />
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
