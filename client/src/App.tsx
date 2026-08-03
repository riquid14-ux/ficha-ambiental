import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import WeeklyForm from "./pages/WeeklyForm";
import AdminPanel from "./pages/AdminPanel";
import SubmissionHistory from "./pages/SubmissionHistory";
import AppLayout from "./components/AppLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/ficha" component={WeeklyForm} />
      <Route path="/ficha/:id" component={WeeklyForm} />
      <Route path="/historico" component={SubmissionHistory} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
