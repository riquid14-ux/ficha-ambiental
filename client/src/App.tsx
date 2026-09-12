import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { Component, ReactNode } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import WeeklyForm from "./pages/WeeklyForm";
import AdminPanel from "./pages/AdminPanel";
import SubmissionHistory from "./pages/SubmissionHistory";
import ReviewPage from "./pages/ReviewPage";
import Profile from "./pages/Profile";
import Matriz from "./pages/Matriz";
import Workflow from "./pages/Workflow";
import Planos from "./pages/Planos";
import Calendario from "./pages/Calendario";
import PhaseMeasures from "./pages/PhaseMeasures";
import Timeline from "./pages/Timeline";
import Certifications from "./pages/Certifications";
import Gamma from "./pages/Gamma";
import CalendarioControl from "./pages/CalendarioControl";
import RDCD from "./pages/RDCD";
import MIRR from "./pages/MIRR";
import KPI from "./pages/KPI";
import Operation from "./pages/Operation";
import EepRequests from "./pages/EepRequests";
import PartnerDashboard from "./pages/PartnerDashboard";
import Welcome from "./pages/Welcome";
import DocumentLibrary from "./pages/DocumentLibrary";

function Router() {
  return (
    <RouteErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/welcome" component={Welcome} />
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
        <Route path="/operacao" component={Operation} />
        <Route path="/pedidos-eep" component={EepRequests} />
        <Route path="/dashboard-parceiros" component={PartnerDashboard} />
        <Route path="/certificacoes" component={Certifications} />
        <Route path="/gamma" component={Gamma} />
        <Route path="/documentacao" component={DocumentLibrary} />
        <Route path="/ficha" component={WeeklyForm} />
        <Route path="/ficha/:id" component={WeeklyForm} />
        <Route path="/historico" component={SubmissionHistory} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/revisao" component={ReviewPage} />
        <Route path="/perfil" component={Profile} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </RouteErrorBoundary>
  );
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">Erro ao carregar página</h2>
            <button onClick={() => window.location.reload()} className="text-primary underline">Recarregar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <LanguageProvider>
            <ProjectProvider>
              <Toaster richColors position="top-right" />
              <Router />
            </ProjectProvider>
          </LanguageProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
