import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import { useCheckIn } from "@workspace/api-client-react";
import { useActiveGroup } from "@/components/active-group-context";

interface NewActivityValue {
  count: number;
  dismissed: boolean;
  dismiss: () => void;
}

const NewActivityContext = createContext<NewActivityValue>({
  count: 0,
  dismissed: false,
  dismiss: () => {},
});

export function useNewActivity(): NewActivityValue {
  return useContext(NewActivityContext);
}

export function NewActivityProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, sessionId } = useAuth();
  const { activeGroupId } = useActiveGroup();
  const checkIn = useCheckIn();
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const checkedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !sessionId || activeGroupId == null) {
      checkedKey.current = null;
      setCount(0);
      setDismissed(false);
      return;
    }

    const key = `${sessionId}:${activeGroupId}`;
    if (checkedKey.current === key) return;
    checkedKey.current = key;

    const sessionKey = `watchlist:activity-checked:${key}`;
    if (sessionStorage.getItem(sessionKey)) {
      setCount(0);
      setDismissed(false);
      return;
    }
    sessionStorage.setItem(sessionKey, "1");

    setCount(0);
    setDismissed(false);
    checkIn.mutate(
      { params: { groupId: activeGroupId } },
      {
        onSuccess: (result) => setCount(result.newCount),
      },
    );
  }, [isSignedIn, sessionId, activeGroupId, checkIn]);

  return (
    <NewActivityContext.Provider
      value={{ count, dismissed, dismiss: () => setDismissed(true) }}
    >
      {children}
    </NewActivityContext.Provider>
  );
}
