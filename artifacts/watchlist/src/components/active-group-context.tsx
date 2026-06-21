import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import {
  useListGroups,
  getListGroupsQueryKey,
  type Group,
} from "@workspace/api-client-react";

const STORAGE_KEY = "watchlist:activeGroupId";

interface ActiveGroupValue {
  groups: Group[];
  activeGroupId: number | null;
  activeGroup: Group | null;
  setActiveGroupId: (id: number) => void;
  hasGroups: boolean;
  isLoading: boolean;
}

const ActiveGroupContext = createContext<ActiveGroupValue>({
  groups: [],
  activeGroupId: null,
  activeGroup: null,
  setActiveGroupId: () => {},
  hasGroups: false,
  isLoading: false,
});

export function useActiveGroup(): ActiveGroupValue {
  return useContext(ActiveGroupContext);
}

export function ActiveGroupProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const { data: groups, isLoading } = useListGroups({
    query: { queryKey: getListGroupsQueryKey(), enabled: !!isSignedIn },
  });

  const list = useMemo(() => groups ?? [], [groups]);

  const [activeGroupId, setActiveGroupIdState] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  });

  useEffect(() => {
    if (list.length === 0) return;
    const exists =
      activeGroupId != null && list.some((g) => g.id === activeGroupId);
    if (!exists) {
      const first = list[0].id;
      setActiveGroupIdState(first);
      localStorage.setItem(STORAGE_KEY, String(first));
    }
  }, [list, activeGroupId]);

  const setActiveGroupId = (id: number) => {
    setActiveGroupIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const activeGroup = useMemo(
    () => list.find((g) => g.id === activeGroupId) ?? null,
    [list, activeGroupId],
  );

  return (
    <ActiveGroupContext.Provider
      value={{
        groups: list,
        activeGroupId,
        activeGroup,
        setActiveGroupId,
        hasGroups: list.length > 0,
        isLoading: !!isSignedIn && isLoading,
      }}
    >
      {children}
    </ActiveGroupContext.Provider>
  );
}
