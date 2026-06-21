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
  const checkIn = useCheckIn();
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const checkedForSession = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !sessionId) {
      checkedForSession.current = null;
      setCount(0);
      setDismissed(false);
      return;
    }
    if (checkedForSession.current === sessionId) return;
    checkedForSession.current = sessionId;

    const sessionKey = `watchlist:activity-checked:${sessionId}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    setCount(0);
    setDismissed(false);
    checkIn.mutate(undefined, {
      onSuccess: (result) => setCount(result.newCount),
    });
  }, [isSignedIn, sessionId, checkIn]);

  return (
    <NewActivityContext.Provider
      value={{ count, dismissed, dismiss: () => setDismissed(true) }}
    >
      {children}
    </NewActivityContext.Provider>
  );
}
