import {
  useListApprovals,
  getListApprovalsQueryKey,
  type ShowApproval,
} from "@workspace/api-client-react";

export function approvalKey(title: string, mediaType: string): string {
  return `${title.trim().toLowerCase()}::${mediaType}`;
}

export function useApprovalMap(): Map<string, ShowApproval> {
  const { data } = useListApprovals({
    query: { queryKey: getListApprovalsQueryKey() },
  });
  const map = new Map<string, ShowApproval>();
  for (const a of data ?? []) {
    map.set(`${a.titleKey}::${a.mediaType}`, a);
  }
  return map;
}
