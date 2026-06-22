import { useEffect, useState } from "react";
import { useCreateOrGetGroupInvite } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Copy, Check, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveGroup } from "@/components/active-group-context";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function InviteDialog() {
  const { toast } = useToast();
  const { activeGroup, activeGroupId } = useActiveGroup();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const create = useCreateOrGetGroupInvite();
  const [link, setLink] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    setLink(null);
  }, [activeGroupId]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setCopied(false);
    if (next && !link && activeGroupId != null) {
      create.mutate(
        { id: activeGroupId },
        {
          onSuccess: (invite) => {
            setLink(
              `${window.location.origin}${basePath}/invite/${invite.token}`,
            );
          },
          onError: () => {
            toast({
              title: "Couldn't create invite link",
              description: "Please try again.",
              variant: "destructive",
            });
          },
        },
      );
    }
  };

  const handleShare = async () => {
    if (!link) return;
    const groupLabel = activeGroup ? `"${activeGroup.name}"` : "my group";
    try {
      await navigator.share({
        title: "Join me on BingeLoop",
        text: `Join ${groupLabel} on BingeLoop to track what we're watching:`,
        url: link,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast({
        title: "Couldn't open share sheet",
        description: "Copy the link instead.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Invite link copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Copy the link manually instead.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 rounded-full px-3 text-muted-foreground hover:text-primary hover:bg-primary/10"
          data-testid="button-invite-friend"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Invite Friend</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a friend</DialogTitle>
          <DialogDescription>
            Share this link. Anyone who opens it can sign up and join
            {activeGroup ? ` "${activeGroup.name}"` : " your group"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={create.isPending ? "Generating link…" : (link ?? "")}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
              data-testid="input-invite-link"
            />
            <Button
              type="button"
              variant={canShare ? "outline" : "default"}
              onClick={handleCopy}
              disabled={!link}
              className="shrink-0"
              data-testid="button-copy-invite"
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span className="ml-1.5 hidden sm:inline">
                {copied ? "Copied" : "Copy"}
              </span>
            </Button>
          </div>
          {canShare && (
            <Button
              type="button"
              onClick={handleShare}
              disabled={!link}
              className="w-full"
              data-testid="button-share-invite"
            >
              <Share2 className="w-4 h-4" />
              <span className="ml-1.5">Share invite</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
