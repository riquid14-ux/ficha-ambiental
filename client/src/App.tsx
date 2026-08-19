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
import Gamma from "./pages/Gamma";
import CalendarioControl from "./pages/CalendarioControl";
import RDCD from "./pages/RDCD";
import MIRR from "./pages/MIRR";
import KPI from "./pages/KPI";

function Router() {
  return (
    <RouteErrorBoundary>
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
            <Route path="/gamma" component={Gamma} />
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

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <LanguageProvider>
            <ProjectProvider>
              <Toaster />
              <Router />
            </ProjectProvider>
          </LanguageProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

// Per-route error boundary that shows a friendly message instead of crashing the whole app
class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Erro ao carregar esta página</h2>
            <p className="text-muted-foreground mb-4">Ocorreu um erro inesperado. Tente recarregar a página ou voltar ao Dashboard.</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/dashboard"; }} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
