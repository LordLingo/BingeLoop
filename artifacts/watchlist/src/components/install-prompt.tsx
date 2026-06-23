import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ArrowDown, Compass, MoreHorizontal, Share, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "bingeloop:install-prompt-dismissed";

function isIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mql) || iosStandalone;
}

// True only for real iOS Safari. Chrome (CriOS), Firefox (FxIOS), Edge (EdgiOS),
// the Google app (GSA), and in-app webviews (Gmail, Messages, Facebook, etc.)
// cannot add to the Home Screen, so we steer those users to open in Safari.
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const otherBrowser = /CriOS|FxIOS|EdgiOS|OPiOS|mercury|GSA/.test(ua);
  const inAppWebView = /FBAN|FBAV|Instagram|Line|Twitter|MicroMessenger|; wv\)/.test(ua);
  const realSafari = /Safari/.test(ua) && /Version\//.test(ua);
  return realSafari && !otherBrowser && !inAppWebView;
}

type InstallHelpContextValue = {
  /** Manually open the install instructions (e.g. from the menu help link). */
  open: () => void;
  /** Whether the current device is an iPhone (controls the menu help link). */
  isIphone: boolean;
};

const InstallHelpContext = createContext<InstallHelpContextValue | null>(null);

export function useInstallHelp(): InstallHelpContextValue {
  const ctx = useContext(InstallHelpContext);
  if (!ctx) {
    throw new Error("useInstallHelp must be used within an InstallHelpProvider");
  }
  return ctx;
}

function NotSafariNotice() {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm leading-relaxed text-white/85">
      <p className="font-semibold text-white">Open this in Safari first</p>
      <p className="mt-1">
        You&apos;re viewing BingeLoop inside another app (like Chrome, Gmail, or
        Messages), which can&apos;t add it to your Home Screen. Tap the
        &ldquo;Open in Safari&rdquo; option in this app&apos;s menu, then come
        back here.
      </p>
    </div>
  );
}

function SafariSteps() {
  return (
    <ol className="space-y-3 text-sm leading-relaxed text-white/85">
      <li className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(46_100%_45%)] text-xs font-bold text-[hsl(0_0%_8%)]">
          1
        </span>
        <span>
          Tap the{" "}
          <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 align-middle font-semibold text-white">
            <MoreHorizontal className="h-4 w-4" />
            &middot;&middot;&middot;
          </span>{" "}
          more button at the bottom of Safari. On some iPhones this appears as
          the Share button{" "}
          <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 align-middle font-semibold text-white">
            <Share className="h-3.5 w-3.5" />
          </span>{" "}
          (a square with an up arrow) instead.
        </span>
      </li>
      <li className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(46_100%_45%)] text-xs font-bold text-[hsl(0_0%_8%)]">
          2
        </span>
        <span>
          Scroll down and tap{" "}
          <span className="font-semibold text-white">Add to Home Screen</span>.
        </span>
      </li>
      <li className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(46_100%_45%)] text-xs font-bold text-[hsl(0_0%_8%)]">
          3
        </span>
        <span>
          Tap <span className="font-semibold text-white">Add</span>.
        </span>
      </li>
    </ol>
  );
}

function InstructionsDialog({
  open,
  onOpenChange,
  safari,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  safari: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-white/15 bg-gradient-to-br from-[#1e3a5f] to-[#142841] text-white sm:max-w-md"
        data-testid="dialog-install-instructions"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl text-white">
            <Compass className="h-5 w-5 text-[hsl(46_100%_50%)]" />
            Add BingeLoop to your Home Screen
          </DialogTitle>
          <DialogDescription className="text-white/70">
            Install BingeLoop for a full-screen, app-like experience.
          </DialogDescription>
        </DialogHeader>
        {safari ? <SafariSteps /> : <NotSafariNotice />}
        {safari && (
          <div className="mt-1 flex items-center justify-center gap-2 text-xs font-medium text-[hsl(46_100%_60%)]">
            <span>Look for it down here</span>
            <ArrowDown className="h-4 w-4 animate-bounce" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InstallBanner({
  safari,
  onOpenInstructions,
  onDismiss,
}: {
  safari: boolean;
  onOpenInstructions: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-white/15 bg-gradient-to-br from-[#1e3a5f] to-[#142841] p-4 text-white shadow-[0_18px_50px_-12px_rgba(15,30,55,0.7)]"
      role="dialog"
      aria-label="Install BingeLoop"
      data-testid="banner-install-prompt"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        data-testid="button-dismiss-install"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(46_100%_45%)] text-[hsl(0_0%_8%)]">
          <Compass className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-base font-semibold leading-tight text-white">
            Add BingeLoop to your Home Screen
          </p>
          <p className="mt-0.5 text-sm text-white/75">
            {safari
              ? "Get the full-screen app experience in one tap."
              : "Open this link in Safari to install it."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          onClick={onOpenInstructions}
          className="h-9 flex-1 bg-[hsl(46_100%_45%)] text-[hsl(0_0%_8%)] hover:bg-[hsl(46_100%_50%)]"
          data-testid="button-show-install-instructions"
        >
          {safari ? "Show me how" : "How to open in Safari"}
        </Button>
      </div>
      {safari && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-[hsl(46_100%_60%)]">
          <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
          <span>Then look for the button at the bottom of Safari</span>
        </div>
      )}
    </div>
  );
}

export function InstallHelpProvider({ children }: { children: ReactNode }) {
  const iphone = useMemo(() => isIphone(), []);
  const standalone = useMemo(() => isStandalone(), []);
  const safari = useMemo(() => isIosSafari(), []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const open = useCallback(() => setDialogOpen(true), []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }, []);

  const value = useMemo<InstallHelpContextValue>(
    () => ({ open, isIphone: iphone }),
    [open, iphone],
  );

  // Only iPhones that haven't installed yet (and haven't dismissed) see the banner.
  const showBanner = iphone && !standalone && !dismissed;

  return (
    <InstallHelpContext.Provider value={value}>
      {children}
      {showBanner && (
        <InstallBanner
          safari={safari}
          onOpenInstructions={open}
          onDismiss={dismiss}
        />
      )}
      <InstructionsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        safari={safari}
      />
    </InstallHelpContext.Provider>
  );
}
