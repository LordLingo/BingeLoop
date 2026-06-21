import {
  useListSpice,
  getListSpiceQueryKey,
  type ShowSpicy,
} from "@workspace/api-client-react";
import { useActiveGroup } from "@/components/active-group-context";

export function spiceKey(title: string, mediaType: string): string {
  return `${title.trim().toLowerCase()}::${mediaType}`;
}

export function useSpiceMap(): Map<string, ShowSpicy> {
  const { activeGroupId } = useActiveGroup();
  const params = activeGroupId != null ? { groupId: activeGroupId } : undefined;
  const { data } = useListSpice(params, {
    query: { queryKey: getListSpiceQueryKey(params) },
  });
  const map = new Map<string, ShowSpicy>();
  for (const s of data ?? []) {
    map.set(`${s.titleKey}::${s.mediaType}`, s);
  }
  return map;
}
