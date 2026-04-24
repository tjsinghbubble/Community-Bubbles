import { Switch, Route, useLocation, useParams, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import NotFound from "@/pages/not-found";
import AuthFlow from "./pages/auth-flow";
import Explore from "./pages/explore";
import CreateBubble from "./pages/create-bubble";
import CreateEvent from "./pages/create-event";
import BubbleDetails from "./pages/bubble-details";
import Messages from "./pages/messages";
import MyBubbles from "./pages/my-bubbles";
import Upcoming from "./pages/upcoming";
import Profile from "./pages/profile";
import ProfileEdit from "./pages/profile-edit";
import ProfileNotifications from "./pages/profile-notifications";
import ProfilePrivacy from "./pages/profile-privacy";
import Legal from "./pages/legal";
import AdminPending from "./pages/admin-pending";
import AdminRules from "./pages/admin-rules";
import AdminMonitor from "./pages/admin-monitor";
import AdminCategories from "./pages/admin-categories";
import AdminLatency from "./pages/admin-latency";
import MobileQR from "./pages/mobile-qr";

function BubbleShortLink() {
  const { shortId } = useParams<{ shortId: string }>();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!shortId) return;
    fetch(`/b/${shortId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) navigate(`/bubble/${data.id}`, { replace: true });
        else navigate("/", { replace: true });
      })
      .catch(() => navigate("/", { replace: true }));
  }, [shortId]);

  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/explore" />}</Route>
      <Route path="/auth" component={AuthFlow} />
      <Route path="/explore" component={Explore} />
      <Route path="/create" component={CreateBubble} />
      <Route path="/create-event" component={CreateEvent} />
      <Route path="/bubble/:id" component={BubbleDetails} />
      <Route path="/my-bubbles" component={MyBubbles} />
      <Route path="/messages" component={Messages} />
      <Route path="/chat/:id" component={Messages} />
      <Route path="/upcoming" component={Upcoming} />
      <Route path="/profile" component={Profile} />
      <Route path="/profile/edit" component={ProfileEdit} />
      <Route path="/profile/notifications" component={ProfileNotifications} />
      <Route path="/profile/privacy" component={ProfilePrivacy} />
      <Route path="/legal/:page" component={Legal} />
      <Route path="/admin/pending" component={AdminPending} />
      <Route path="/admin/rules" component={AdminRules} />
      <Route path="/admin/monitor" component={AdminMonitor} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/latency" component={AdminLatency} />
      <Route path="/b/:shortId" component={BubbleShortLink} />
      <Route path="/mobile" component={MobileQR} />
      <Route path="/qr-code" component={MobileQR} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
