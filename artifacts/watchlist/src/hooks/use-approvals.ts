import {
  useListApprovals,
  getListApprovalsQueryKey,
  type ShowApproval,
} from "@workspace/api-client-react";
import { useActiveGroup } from "@/components/active-group-context";

export function approvalKey(title: string, mediaType: string): string {
  return `${title.trim().toLowerCase()}::${mediaType}`;
}

export function useApprovalMap(): Map<string, ShowApproval> {
  const { activeGroupId } = useActiveGroup();
  const params = activeGroupId != null ? { groupId: activeGroupId } : undefined;
  const { data } = useListApprovals(params, {
    query: { queryKey: getListApprovalsQueryKey(params) },
  });
  const map = new Map<string, ShowApproval>();
  for (const a of data ?? []) {
    map.set(`${a.titleKey}::${a.mediaType}`, a);
  }
  return map;
}
