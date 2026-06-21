import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  acceptInvite,
  getListEntriesQueryKey,
  getGetStatsQueryKey,
  getListGroupsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { PENDING_INVITE_KEY } from "@/lib/invite";
import { useActiveGroup } from "@/components/active-group-context";

export function InviteAccepter() {
  const { isSignedIn, user } = useUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { setActiveGroupId } = useActiveGroup();
  const [location, setLocation] = useLocation();
  const handling = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !user || handling.current) return;
    const token = localStorage.getItem(PENDING_INVITE_KEY);
    if (!token) return;

    handling.current = true;
    void (async () => {
      try {
        const result = await acceptInvite(token);
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
      } catch {
        localStorage.removeItem(PENDING_INVITE_KEY);
      } finally {
        handling.current = false;
      }
    })();
  }, [isSignedIn, user, location, qc, toast, setLocation, setActiveGroupId]);

  return null;
}
