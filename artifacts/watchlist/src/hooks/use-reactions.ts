import {
  useListReactions,
  getListReactionsQueryKey,
  type ReactionSummary,
  type ReactionTargetType,
} from "@workspace/api-client-react";
import { useActiveGroup } from "@/components/active-group-context";

export function reactionKey(
  targetType: ReactionTargetType,
  targetId: number,
): string {
  return `${targetType}:${targetId}`;
}

export function useReactionMap(): Map<string, ReactionSummary> {
  const { activeGroupId } = useActiveGroup();
  const params = activeGroupId != null ? { groupId: activeGroupId } : undefined;
  const { data } = useListReactions(params, {
    query: { queryKey: getListReactionsQueryKey(params) },
  });
  const map = new Map<string, ReactionSummary>();
  for (const r of data ?? []) {
    map.set(reactionKey(r.targetType, r.targetId), r);
  }
  return map;
}
