import {
  useListAudiences,
  getListAudiencesQueryKey,
  type ShowAudience,
} from "@workspace/api-client-react";
import { useActiveGroup } from "@/components/active-group-context";

export function audienceKey(title: string, mediaType: string): string {
  return `${title.trim().toLowerCase()}::${mediaType}`;
}

export function useAudienceMap(): Map<string, ShowAudience> {
  const { activeGroupId } = useActiveGroup();
  const params = activeGroupId != null ? { groupId: activeGroupId } : undefined;
  const { data } = useListAudiences(params, {
    query: { queryKey: getListAudiencesQueryKey(params) },
  });
  const map = new Map<string, ShowAudience>();
  for (const a of data ?? []) {
    map.set(audienceKey(a.titleKey, a.mediaType), a);
  }
  return map;
}
