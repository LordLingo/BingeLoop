import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateProfile } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_LEN = 40;

function errorMessage(err: unknown): string {
  const data = (err as { data?: { error?: string } } | null)?.data;
  return data?.error ?? "Couldn't save that name. Please try again.";
}

// The shared display-name editor: input + inline error + save button. Saving
// upserts the profile and refetches everything (the name is denormalized into
// many cached responses) before invoking onSaved.
export function DisplayNameForm({
  initialName = "",
  conflictMessage,
  submitLabel = "Save name",
  onSaved,
}: {
  initialName?: string;
  conflictMessage?: string;
  submitLabel?: string;
  onSaved?: (name: string) => void;
}) {
  const qc = useQueryClient();
  const update = useUpdateProfile();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(conflictMessage ?? null);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);
  useEffect(() => {
    setError(conflictMessage ?? null);
  }, [conflictMessage]);

  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed || update.isPending) return;
    setError(null);
    update.mutate(
      { data: { displayName: trimmed } },
      {
        onSuccess: async (profile) => {
          await qc.invalidateQueries();
          onSaved?.(profile.displayName ?? trimmed);
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="e.g. Sam"
          maxLength={MAX_LEN}
          autoFocus
          data-testid="input-display-name"
        />
        {error && (
          <p
            className="text-sm text-destructive"
            data-testid="text-display-name-error"
          >
            {error}
          </p>
        )}
      </div>
      <Button
        onClick={submit}
        disabled={!trimmed || update.isPending}
        className="w-full"
        data-testid="button-save-display-name"
      >
        {update.isPending ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}

// Full-screen, non-dismissible prompt shown right after signup (and to any
// legacy user without a name) so a card or comment never shows their email.
export function SetDisplayNameScreen({
  initialName = "",
  onSaved,
}: {
  initialName?: string;
  onSaved?: (name: string) => void;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-72 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="z-10 w-full max-w-md space-y-6 text-center">
        <Film className="w-12 h-12 text-primary mx-auto" />
        <div className="space-y-2">
          <h1 className="text-4xl font-serif tracking-wide">
            Pick a display name
          </h1>
          <p className="text-muted-foreground">
            This is how friends will see you across BingeLoop — on the shows you
            log, your comments, and the activity feed. Your email is never shown.
          </p>
        </div>
        <DisplayNameForm
          initialName={initialName}
          submitLabel="Continue"
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}

// Dismissible dialog for editing the name from settings, or for resolving a
// name conflict when joining a group.
export function DisplayNameDialog({
  open,
  onOpenChange,
  initialName = "",
  conflictMessage,
  title = "Display name",
  description = "This is the name other members see. Your email is never shown.",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  conflictMessage?: string;
  title?: string;
  description?: string;
  onSaved?: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DisplayNameForm
          initialName={initialName}
          conflictMessage={conflictMessage}
          onSaved={(name) => {
            onSaved?.(name);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
