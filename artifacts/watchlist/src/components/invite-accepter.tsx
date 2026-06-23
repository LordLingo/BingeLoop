import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  acceptInvite,
  getListEntriesQueryKey,
  getGetStatsQueryKey,
  getListGroupsQueryKey,
  useGetProfile,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { PENDING_INVITE_KEY } from "@/lib/invite";
import { useActiveGroup } from "@/components/active-group-context";
import { DisplayNameDialog } from "@/components/display-name-dialog";

export function InviteAccepter() {
  const { isSignedIn, user } = useUser();
  const { data: profile } = useGetProfile();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { setActiveGroupId } = useActiveGroup();
  const [location, setLocation] = useLocation();
  const handling = useRef(false);
  const [conflict, setConflict] = useState<{ token: string; message: string } | null>(
    null,
  );

  const finishAccept = async (result: Awaited<ReturnType<typeof acceptInvite>>) => {
    localStorage.removeItem(PENDING_INVITE_KEY);
    await qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
    qc.invalidateQueries({ queryKey: getListEntriesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    if (result.groupId != null) {
      setActiveGroupId(result.groupId);
    }
    if (result.joined) {
      toast({
        title: "You're in!",
        description: `You joined "${result.groupName}".`,
      });
    }
    setLocation("/library");
  };

  useEffect(() => {
    if (!isSignedIn || !user || handling.current) return;
    // Name-first: don't auto-accept (a membership mutation) until the user has a
    // display name, so the forced gate always runs before any group is joined.
    if (!profile?.displayName) return;
    const token = localStorage.getItem(PENDING_INVITE_KEY);
    if (!token) return;

    handling.current = true;
    void (async () => {
      try {
        const result = await acceptInvite(token);
        await finishAccept(result);
      } catch (err) {
        const data = (err as { status?: number; data?: { code?: string; error?: string } } | null);
        // A display-name clash in the target group: keep the pending invite and
        // ask the user to pick a different name, then retry the accept.
        if (data?.status === 409 && data.data?.code === "name_taken") {
          setConflict({
            token,
            message:
              data.data.error ??
              "Someone in this group already uses that name. Please pick another.",
          });
        } else {
          localStorage.removeItem(PENDING_INVITE_KEY);
        }
      } finally {
        handling.current = false;
      }
    })();
  }, [
    isSignedIn,
    user,
    profile?.displayName,
    location,
    qc,
    toast,
    setLocation,
    setActiveGroupId,
  ]);

  return (
    <DisplayNameDialog
      open={conflict !== null}
      onOpenChange={(open) => {
        if (!open) {
          // User backed out of resolving the clash — abandon the invite.
          localStorage.removeItem(PENDING_INVITE_KEY);
          setConflict(null);
        }
      }}
      initialName={user?.firstName ?? ""}
      conflictMessage={conflict?.message}
      title="Pick a name for this group"
      description="Someone in this group already uses your current name. Choose a different one to join. Your email is never shown."
      onSaved={() => {
        const pending = conflict;
        setConflict(null);
        if (!pending) return;
        void (async () => {
          try {
            const result = await acceptInvite(pending.token);
            await finishAccept(result);
          } catch {
            localStorage.removeItem(PENDING_INVITE_KEY);
          }
        })();
      }}
    />
  );
}
