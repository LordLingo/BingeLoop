import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  useGetGroup,
  getGetGroupQueryKey,
  useRenameGroup,
  useLeaveGroup,
  useCreateOrGetGroupInvite,
  getListGroupsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  Users,
  Copy,
  Check,
  LogOut,
  Pencil,
  Crown,
  ChevronRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useActiveGroup } from "@/components/active-group-context";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function GroupPage() {
  const { activeGroupId, setActiveGroupId, groups } = useActiveGroup();
  const { user } = useUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: group, isLoading } = useGetGroup(activeGroupId ?? 0, {
    query: {
      enabled: activeGroupId != null,
      queryKey: getGetGroupQueryKey(activeGroupId ?? 0),
    },
  });

  const rename = useRenameGroup();
  const leave = useLeaveGroup();
  const invite = useCreateOrGetGroupInvite();

  const isOwner = group?.role === "owner";

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLink(null);
    setCopied(false);
    setEditing(false);
  }, [activeGroupId]);

  const startEdit = () => {
    setName(group?.name ?? "");
    setEditing(true);
  };

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed || !activeGroupId || rename.isPending) return;
    rename.mutate(
      { id: activeGroupId, data: { name: trimmed } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetGroupQueryKey(activeGroupId) });
          qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          setEditing(false);
          toast({ title: "Group renamed" });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't rename group",
            description: "Please try again.",
          }),
      },
    );
  };

  const generateInvite = () => {
    if (!activeGroupId || invite.isPending) return;
    invite.mutate(
      { id: activeGroupId },
      {
        onSuccess: (inv) => {
          setLink(`${window.location.origin}${basePath}/invite/${inv.token}`);
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't create invite link",
            description: "Please try again.",
          }),
      },
    );
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Invite link copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't copy",
        description: "Copy the link manually instead.",
      });
    }
  };

  const handleLeave = () => {
    if (!activeGroupId) return;
    leave.mutate(
      { id: activeGroupId },
      {
        onSuccess: () => {
          const remaining = groups.filter((g) => g.id !== activeGroupId);
          qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          if (remaining.length > 0) {
            setActiveGroupId(remaining[0].id);
            setLocation("/library");
          } else {
            setLocation("/library");
          }
          toast({ title: "You left the group" });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't leave group",
            description: "Please try again.",
          }),
      },
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex items-center gap-2 px-4 pt-6 pb-2 text-foreground">
        <Link
          href="/library"
          className="rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          data-testid="link-back-library"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2.5 font-serif text-2xl sm:text-3xl tracking-[0.18em] text-primary">
          <Users className="w-6 h-6 text-primary shrink-0" />
          GROUP
        </div>
      </div>

      <section className="cinematic-panel text-foreground pt-4 pb-8 px-6 rounded-b-[2.5rem] border-b border-border/60 mb-6">
        <div className="max-w-2xl mx-auto">
          {isLoading || !group ? (
            <Skeleton className="h-12 w-2/3 rounded-lg" />
          ) : editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                }}
                maxLength={60}
                autoFocus
                className="text-2xl h-12"
                data-testid="input-rename-group"
              />
              <Button
                onClick={saveName}
                disabled={rename.isPending}
                data-testid="button-save-name"
              >
                Save
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-5xl font-serif tracking-wide text-foreground">
                {group.name}
              </h1>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground hover:text-primary"
                  onClick={startEdit}
                  data-testid="button-edit-group-name"
                >
                  <Pencil className="w-5 h-5" />
                </Button>
              )}
            </div>
          )}
          <p className="text-muted-foreground mt-2 text-sm">
            {group ? `${group.memberCount} member${group.memberCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      </section>

      <main className="max-w-2xl mx-auto px-4 space-y-8">
        {/* Invite */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Invite people
          </h2>
          {link ? (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
                data-testid="input-invite-link"
              />
              <Button
                type="button"
                onClick={copyLink}
                className="shrink-0"
                data-testid="button-copy-invite"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="ml-1.5 hidden sm:inline">
                  {copied ? "Copied" : "Copy"}
                </span>
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={generateInvite}
              disabled={invite.isPending}
              data-testid="button-generate-invite"
            >
              {invite.isPending ? "Generating…" : "Create invite link"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Anyone who opens this link can join "{group?.name ?? "this group"}".
          </p>
        </div>

        {/* Members */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Members
          </h2>
          <div className="space-y-2">
            {(group?.members ?? []).map((m) => {
              const isSelf = m.userId === user?.id;
              const content = (
                <div
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3",
                    !isSelf && "hover:bg-muted/40 transition-colors",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">
                      {m.displayName}
                    </span>
                    {isSelf && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                    {m.role === "owner" && (
                      <Crown className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                  {!isSelf && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
              return isSelf ? (
                <div key={m.userId} data-testid={`member-${m.userId}`}>
                  {content}
                </div>
              ) : (
                <Link
                  key={m.userId}
                  href={`/member/${m.userId}`}
                  data-testid={`member-${m.userId}`}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Leave */}
        <div className="pt-4 border-t border-border/60">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                data-testid="button-leave-group"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave this group
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave "{group?.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll stop seeing this group's shared activity. Your own
                  entries, watchlist, and ratings stay with you. You can rejoin
                  later with an invite link.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLeave}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Leave group
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </div>
  );
}
