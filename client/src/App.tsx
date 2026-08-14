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
import Workflow from "./pages/Workflow";
import Planos from "./pages/Planos";
import Calendario from "./pages/Calendario";
import PhaseMeasures from "./pages/PhaseMeasures";
import Timeline from "./pages/Timeline";
import Certifications from "./pages/Certifications";
import CalendarioControl from "./pages/CalendarioControl";
import RDCD from "./pages/RDCD";
import MIRR from "./pages/MIRR";
import KPI from "./pages/KPI";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/matriz" component={Matriz} />
      <Route path="/workflow" component={Workflow} />
      <Route path="/planos" component={Planos} />
      <Route path="/calendario" component={Calendario} />
      <Route path="/fases" component={PhaseMeasures} />
      <Route path="/timeline" component={Timeline} />
      <Route path="/calendario-control" component={CalendarioControl} />
      <Route path="/rdcd" component={RDCD} />
      <Route path="/mirr" component={MIRR} />
      <Route path="/residuos" component={MIRR} />
      <Route path="/kpi" component={KPI} />
            <Route path="/certificacoes" component={Certifications} />
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
