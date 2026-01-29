import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "./pages/home";
import AuthFlow from "./pages/auth-flow";
import Explore from "./pages/explore";
import CreateBubble from "./pages/create-bubble";
import BubbleDetails from "./pages/bubble-details";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthFlow} />
      <Route path="/explore" component={Explore} />
      <Route path="/create" component={CreateBubble} />
      <Route path="/bubble/:id" component={BubbleDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
