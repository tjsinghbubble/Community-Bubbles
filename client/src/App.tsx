import { Switch, Route, useLocation, useParams, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import NotFound from "@/pages/not-found";
import Explore from "./pages/explore";
import CreateBubble from "./pages/create-bubble";
import CreateEvent from "./pages/create-event";
import EditEvent from "./pages/edit-event";
import EventDetails from "./pages/event-details";
import BubbleDetails from "./pages/bubble-details";
import EditBubble from "./pages/edit-bubble";
import BubbleInsights from "./pages/bubble-insights";
import Messages from "./pages/messages";
import MyBubbles from "./pages/my-bubbles";
import Upcoming from "./pages/upcoming";
import Profile from "./pages/profile";
import ProfileView from "./pages/profile-view";
import ProfileEdit from "./pages/profile-edit";
import ProfileNotifications from "./pages/profile-notifications";
import ProfilePrivacy from "./pages/profile-privacy";
import GetHelp from "./pages/get-help";
import HelpCenter from "./pages/help-center";
import GiveFeedback from "./pages/give-feedback";
import FeatureRequest from "./pages/feature-request";
import DefectReport from "./pages/defect-report";
import ReportConcern from "./pages/report-concern";
import Legal from "./pages/legal";
import AdminPending from "./pages/admin-pending";
import AdminRules from "./pages/admin-rules";
import AdminMonitor from "./pages/admin-monitor";
import AdminCategories from "./pages/admin-categories";
import AdminLatency from "./pages/admin-latency";
import AdminSlowCalls from "./pages/admin-slow-calls";
import MobileQR from "./pages/mobile-qr";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import VerifyEmail from "./pages/verify-email";
import Guidelines from "./pages/guidelines";

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

// The login/signup experience lives entirely on the static marketing page at
// "/" now. Old /auth links (bookmarks, in-app navigate("/auth") calls) do a
// full-page redirect there, carrying an ?email= prefill if one was provided.
// A full page load is required — the SPA router's "/" route goes to /explore.
function AuthRedirect() {
  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email");
    window.location.replace(email ? `/?email=${encodeURIComponent(email)}` : "/");
  }, []);
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
      <Route path="/auth" component={AuthRedirect} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/guidelines" component={Guidelines} />
      <Route path="/explore" component={Explore} />
      <Route path="/create" component={CreateBubble} />
      <Route path="/create-event" component={CreateEvent} />
      <Route path="/event/:id/edit" component={EditEvent} />
      <Route path="/event/:id" component={EventDetails} />
      <Route path="/bubble/:id" component={BubbleDetails} />
      <Route path="/bubble/:id/edit" component={EditBubble} />
      <Route path="/bubble/:id/insights" component={BubbleInsights} />
      <Route path="/my-bubbles" component={MyBubbles} />
      <Route path="/messages" component={Messages} />
      <Route path="/chat/:id" component={Messages} />
      <Route path="/upcoming" component={Upcoming} />
      <Route path="/profile" component={Profile} />
      <Route path="/profile/view/:userId" component={ProfileView} />
      <Route path="/profile/edit" component={ProfileEdit} />
      <Route path="/profile/notifications" component={ProfileNotifications} />
      <Route path="/profile/privacy" component={ProfilePrivacy} />
      <Route path="/get-help" component={GetHelp} />
      <Route path="/help-center" component={HelpCenter} />
      <Route path="/give-feedback" component={GiveFeedback} />
      <Route path="/feature-request" component={FeatureRequest} />
      <Route path="/defect-report" component={DefectReport} />
      <Route path="/report-concern" component={ReportConcern} />
      <Route path="/legal/:page" component={Legal} />
      <Route path="/admin/pending" component={AdminPending} />
      <Route path="/admin/rules" component={AdminRules} />
      <Route path="/admin/monitor" component={AdminMonitor} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/latency" component={AdminLatency} />
      <Route path="/admin/slow-calls" component={AdminSlowCalls} />
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
