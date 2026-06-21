import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateGroup,
  getListGroupsQueryKey,
  type Group,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useActiveGroup } from "@/components/active-group-context";

export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (group: Group) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const create = useCreateGroup();
  const { setActiveGroupId } = useActiveGroup();
  const [name, setName] = useState("");

  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed || create.isPending) return;
    create.mutate(
      { data: { name: trimmed } },
      {
        onSuccess: (group) => {
          qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          setActiveGroupId(group.id);
          setName("");
          onOpenChange(false);
          onCreated?.(group);
          toast({
            title: "Group created",
            description: `"${group.name}" is ready. Invite your friends!`,
          });
        },
        onError: () =>
          toast({
            variant: "destructive",
            title: "Couldn't create group",
            description: "Please try again.",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>
            Name your group — something like "Movie Night" or "The Family". You
            can invite friends once it's created.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Movie Night"
            maxLength={60}
            autoFocus
            data-testid="input-group-name"
          />
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={!trimmed || create.isPending}
            data-testid="button-create-group"
          >
            {create.isPending ? "Creating…" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
