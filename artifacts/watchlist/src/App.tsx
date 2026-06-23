import { Switch, Route, useLocation, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { useEffect } from "react";

import { NewActivityProvider } from "@/components/new-activity-context";
import { ActiveGroupProvider, useActiveGroup } from "@/components/active-group-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AddEntry from "@/pages/add-entry";
import AssignEntries from "@/pages/assign-entries";
import ViewEntry from "@/pages/view-entry";
import WatchlistPage from "@/pages/watchlist";
import ActivityPage from "@/pages/activity";
import GroupPage from "@/pages/group";
import MemberPage from "@/pages/member";
import ListsPage from "@/pages/lists";
import ListDetailPage from "@/pages/list-detail";
import Onboarding from "@/pages/onboarding";
import AdminPage from "@/pages/admin";
import Landing from "@/pages/landing";
import { useGetProfile } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { SetDisplayNameScreen } from "@/components/display-name-dialog";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import InvitePage from "@/pages/invite";
import { InviteAccepter } from "@/components/invite-accepter";
import { InstallHelpProvider } from "@/components/install-prompt";
import { useVisibilityRecovery } from "@/hooks/use-visibility-recovery";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");

const queryClient = new QueryClient();

function ClerkQueryClientCacheInvalidator() {
  const clerk = useClerk();
  const qc = useQueryClient();
  
  useEffect(() => {
    let lastUserId = clerk.user?.id;
    return clerk.addListener(({ user }) => {
      if (user?.id !== lastUserId) {
        qc.clear();
        lastUserId = user?.id;
      }
    });
  }, [clerk, qc]);
  
  return null;
}

// Recovers the iOS blank/white screen when the app is reopened after iOS purged
// it from memory while backgrounded. Mounted inside QueryClientProvider so it
// can refetch active data.
function VisibilityRecovery() {
  useVisibilityRecovery();
  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-out"><Landing /></Show>
      <Show when="signed-in"><Redirect to="/library" /></Show>
    </>
  );
}

function GroupGate({ children }: { children: React.ReactNode }) {
  const { isLoading, hasGroups } = useActiveGroup();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!hasGroups) return <Onboarding />;
  return <>{children}</>;
}

// Forces a signed-in user to set a display name before anything else renders, so
// a card/comment never shows their email — not even briefly. Runs BEFORE the
// group gate (name first, then create/join a group).
function DisplayNameGate({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { data, isLoading } = useGetProfile();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!data?.displayName) {
    return <SetDisplayNameScreen initialName={user?.firstName ?? ""} />;
  }
  return <>{children}</>;
}

function AuthRoute({
  component: Component,
  requireGroup = true,
}: {
  component: React.ComponentType;
  requireGroup?: boolean;
}) {
  return (
    <>
      <Show when="signed-in">
        <DisplayNameGate>
          {requireGroup ? (
            <GroupGate>
              <Component />
            </GroupGate>
          ) : (
            <Component />
          )}
        </DisplayNameGate>
      </Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/library"><AuthRoute component={Home} /></Route>
      <Route path="/watchlist"><AuthRoute component={WatchlistPage} /></Route>
      <Route path="/activity"><AuthRoute component={ActivityPage} /></Route>
      <Route path="/group"><AuthRoute component={GroupPage} /></Route>
      <Route path="/member/:userId"><AuthRoute component={MemberPage} /></Route>
      <Route path="/lists"><AuthRoute component={ListsPage} /></Route>
      <Route path="/lists/:id"><AuthRoute component={ListDetailPage} /></Route>
      <Route path="/admin"><AuthRoute component={AdminPage} requireGroup={false} /></Route>
      <Route path="/add"><AuthRoute component={AddEntry} /></Route>
      <Route path="/unassigned"><AuthRoute component={AssignEntries} /></Route>
      <Route path="/entry/:id"><AuthRoute component={ViewEntry} /></Route>
      <Route path="/invite/:token" component={InvitePage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      appearance={{
        theme: shadcn,
        cssLayerName: "clerk",
        options: {
          logoPlacement: "inside",
          logoLinkUrl: basePath || "/",
          logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
        },
        variables: {
          colorPrimary: "hsl(345, 60%, 40%)",
          colorForeground: "hsl(224, 71%, 12%)",
          colorMutedForeground: "hsl(220, 15%, 40%)",
          colorBackground: "hsl(40, 33%, 98%)",
          colorInput: "hsl(40, 20%, 88%)",
          colorInputForeground: "hsl(224, 71%, 12%)",
          colorDanger: "hsl(0, 84%, 60%)",
          colorNeutral: "hsl(40, 20%, 90%)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          borderRadius: "1rem",
        },
        elements: {
          cardBox: "w-[440px] max-w-full bg-background border-border shadow-lg",
          card: "!bg-transparent",
          footer: "!bg-transparent",
          headerTitle: "text-foreground font-serif font-bold text-2xl tracking-tight",
          headerSubtitle: "text-muted-foreground text-sm",
          socialButtonsBlockButtonText: "text-foreground font-medium",
          formFieldLabel: "text-foreground font-medium",
          footerActionLink: "text-primary font-medium hover:text-primary/80",
          footerActionText: "text-muted-foreground",
          dividerText: "text-muted-foreground text-xs",
        },
      }}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to access BingeLoop",
          },
        },
        signUp: {
          start: {
            title: "Join BingeLoop",
            subtitle: "Create an account to start logging",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <VisibilityRecovery />
        <ActiveGroupProvider>
          <InviteAccepter />
          <NewActivityProvider>
            <TooltipProvider>
              <InstallHelpProvider>
                <WouterRouter base={basePath}>
                  <Router />
                </WouterRouter>
              </InstallHelpProvider>
              <Toaster />
            </TooltipProvider>
          </NewActivityProvider>
        </ActiveGroupProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
