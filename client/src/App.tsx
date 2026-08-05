import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import WeeklyForm from "./pages/WeeklyForm";
import AdminPanel from "./pages/AdminPanel";
import SubmissionHistory from "./pages/SubmissionHistory";
import ReviewPage from "./pages/ReviewPage";
import AppLayout from "./components/AppLayout";
import Profile from "./pages/Profile";
import Matriz from "./pages/Matriz";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/matriz" component={Matriz} />
      <Route path="/ficha" component={WeeklyForm} />
      <Route path="/ficha/:id" component={WeeklyForm} />
      <Route path="/historico" component={SubmissionHistory} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/revisao" component={ReviewPage} />
      <Route path="/perfil" component={Profile} />
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
          <ProjectProvider>
            <Toaster />
            <Router />
          </ProjectProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
