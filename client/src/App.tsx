import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { Component, ReactNode, lazy, Suspense } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import AppLayout from "./components/AppLayout";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const WeeklyForm = lazy(() => import("./pages/WeeklyForm"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const SubmissionHistory = lazy(() => import("./pages/SubmissionHistory"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const Profile = lazy(() => import("./pages/Profile"));
const Matriz = lazy(() => import("./pages/Matriz"));
const Workflow = lazy(() => import("./pages/Workflow"));
const Planos = lazy(() => import("./pages/Planos"));
const Calendario = lazy(() => import("./pages/Calendario"));
const PhaseMeasures = lazy(() => import("./pages/PhaseMeasures"));
const Timeline = lazy(() => import("./pages/Timeline"));
const Certifications = lazy(() => import("./pages/Certifications"));
const Gamma = lazy(() => import("./pages/Gamma"));
const CalendarioControl = lazy(() => import("./pages/CalendarioControl"));
const RDCD = lazy(() => import("./pages/RDCD"));
const MIRR = lazy(() => import("./pages/MIRR"));
const KPI = lazy(() => import("./pages/KPI"));
const Welcome = lazy(() => import("./pages/Welcome"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">A carregar...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <RouteErrorBoundary>
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
    </RouteErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
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
