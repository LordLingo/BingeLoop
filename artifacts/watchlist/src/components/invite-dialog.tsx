import { useState } from "react";
import { useCreateOrGetInvite } from "@workspace/api-client-react";
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
import { UserPlus, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function InviteDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const create = useCreateOrGetInvite();
  const [link, setLink] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setCopied(false);
    if (next && !link) {
      create.mutate(undefined, {
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
            Share this link. Anyone who opens it can sign up and instantly join
            your shared watchlist.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 pt-2">
          <Input
            readOnly
            value={create.isPending ? "Generating link…" : (link ?? "")}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
            data-testid="input-invite-link"
          />
          <Button
            type="button"
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
      </DialogContent>
    </Dialog>
  );
}
