import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Show } from "@clerk/react";
import { useGetInvitePreview } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Film, UserPlus } from "lucide-react";
import { PENDING_INVITE_KEY } from "@/lib/invite";

export default function InvitePage() {
  const params = useParams();
  const token = params.token ?? "";
  const [, setLocation] = useLocation();

  const { data: preview, isLoading } = useGetInvitePreview(token);

  useEffect(() => {
    if (token) localStorage.setItem(PENDING_INVITE_KEY, token);
  }, [token]);

  const inviterName = preview?.inviterName?.trim();
  const groupName = preview?.groupName?.trim();
  const valid = preview?.valid ?? false;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-72 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="z-10 w-full max-w-md text-center space-y-6">
        <div className="flex items-center justify-center gap-2.5 font-serif text-3xl tracking-[0.18em] text-primary">
          <Film className="w-7 h-7 shrink-0" />
          BINGELOOP
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading invite…</p>
        ) : !valid ? (
          <div className="space-y-4">
            <h1 className="text-3xl font-serif tracking-wide">
              Invite not found
            </h1>
            <p className="text-muted-foreground">
              This invite link is invalid or has been removed.
            </p>
            <Button onClick={() => setLocation("/")} className="rounded-full">
              Go to Watchlist
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <UserPlus className="w-10 h-10 text-primary mx-auto" />
              <h1 className="text-3xl font-serif tracking-wide">
                {inviterName
                  ? `${inviterName} invited you`
                  : "You've been invited"}
              </h1>
              <p className="text-muted-foreground">
                {groupName
                  ? `Join "${groupName}" to log shows, rate them, and see what the group's watching.`
                  : "Join the group to log shows, rate them, and see what everyone's watching."}
              </p>
            </div>

            <Show when="signed-out">
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setLocation("/sign-up")}
                  className="rounded-full"
                  data-testid="button-invite-signup"
                >
                  Sign up to join
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/sign-in")}
                  className="rounded-full"
                  data-testid="button-invite-signin"
                >
                  Already have an account? Sign in
                </Button>
              </div>
            </Show>

            <Show when="signed-in">
              <p className="text-muted-foreground text-sm">
                Joining the watchlist…
              </p>
            </Show>
          </div>
        )}
      </div>
    </div>
  );
}
