import React from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { requiresTwoFactorEnrollment } from "@/lib/two-factor-policy";
import { useProject } from "@/contexts/ProjectContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { LOGO_URL } from "@/lib/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import { useIsMobile } from "@/hooks/useMobile";
import { ClipboardList, History, LayoutDashboard, LogOut, PanelLeft, Shield, FileSearch, UserCircle, FolderKanban , MessageSquare} from "lucide-react";
import { Grid3X3, FileText, CalendarDays, Settings2, FileBarChart } from "lucide-react";
import { BookOpen, Layers, GitBranch, Heart } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Recycle, Home, Bell, Gauge } from "lucide-react";
import { isProjectRouteEnabled } from "@/lib/project-modules";
import { getVisibleNavigationPaths } from "@/lib/role-navigation";

// Projects that are operation-only (no construction phase)
const OPERATION_ONLY_PROJECT_CODES = ["SIN01"];

// Menu items for individual project view
const projectMenuItems = [
  { icon: Home, label: "Bem-vindo", path: "/welcome" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FileText, label: "Planos", path: "/planos" },
  { icon: CalendarDays, label: "Calendário", path: "/calendario" },
  { icon: GitBranch, label: "Timeline", path: "/timeline" },
  { icon: ClipboardList, label: "Ficha Semanal", path: "/ficha" },
  { icon: Recycle, label: "Gestão de Resíduos", path: "/residuos" },
  { icon: BarChart3, label: "KPI's", path: "/kpi" },
  { icon: BookOpen, label: "Documentação", path: "/documentacao" },
];

// Menu items for operation-only projects (no construction workflow)
const operationProjectMenuItems = [
  { icon: Home, label: "Bem-vindo", path: "/welcome" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Gauge, label: "Operação", path: "/operacao" },
  { icon: FileText, label: "Planos", path: "/planos" },
  { icon: CalendarDays, label: "Calendário", path: "/calendario" },
  { icon: Recycle, label: "MIRR", path: "/mirr" },
  { icon: Layers, label: "Fases", path: "/fases" },
  { icon: FileBarChart, label: "Certificações", path: "/certificacoes" },
  { icon: BookOpen, label: "Documentação", path: "/documentacao" },
];

// Menu items for "Todos os Projetos" view
const allProjectsMenuItems = [
  { icon: Home, label: "Bem-vindo", path: "/welcome" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FileText, label: "Planos", path: "/planos" },
  { icon: CalendarDays, label: "Calendário", path: "/calendario" },
  { icon: GitBranch, label: "Timeline", path: "/timeline" },
  { icon: FileBarChart, label: "RDCD", path: "/rdcd" },
  { icon: Heart, label: "GAMMA", path: "/gamma" },
];

const adminMenuItems = [
  // Control Room is now integrated into Calendário page
  { icon: Shield, label: "Administração", path: "/admin" },
];
const reviewMenuItems: typeof projectMenuItems = [
];

const eeAdditionalMenuItems = [
  { icon: BarChart3, label: "Dashboard Parceiros", path: "/dashboard-parceiros" },
  { icon: ClipboardList, label: "Pedidos EEP", path: "/pedidos-eep" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [loading, user, setLocation]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) return null;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <AppLayoutContent setSidebarWidth={setSidebarWidth}>{children}</AppLayoutContent>
    </SidebarProvider>
  );
}

function AppLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (w: number) => void }) {
  const { user, logout } = useAuth();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackPhotos, setFeedbackPhotos] = useState<File[]>([]);
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  // Password verification for OAuth-authenticated users
  const [passwordVerified, setPasswordVerified] = useState(() => sessionStorage.getItem("pw_verified") === "1");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const verifyPasswordMutation = trpc.auth.login.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        sessionStorage.setItem("pw_verified", "1");
        setPasswordVerified(true);
      }
    },
    onError: () => setPwError("Palavra-passe incorreta"),
  });
  // Password check disabled - users login via Login page directly
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [qrData, setQrData] = useState<{ qrCode: string; secret: string } | null>(null);

  const setup2FAMutation = trpc.auth.setup2FA.useMutation({
    onSuccess: (data) => { setQrData({ qrCode: data.qrCode, secret: data.secret }); },
  });
  const confirm2FAMutation = trpc.auth.confirm2FA.useMutation({
    onSuccess: () => { setShow2FASetup(false); setQrData(null); setTotpCode(""); window.location.reload(); },
  });

  // A extensão individual de 2FA prevalece sobre o prazo padrão; 2FA já activo nunca é desactivado.
  const needs2FA = requiresTwoFactorEnrollment(user as any);

  const { projects, activeProject, setActiveProjectId, isAllProjects, canSeeAllProjects } = useProject();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const userRole = user?.role || "user";
  const { data: partnerAccess } = trpc.partners.myAccess.useQuery(undefined, { enabled: userRole === "ee_partner" });
  const canAdmin = userRole === "admin";
  const isOperationOnly = !isAllProjects && !!activeProject && OPERATION_ONLY_PROJECT_CODES.includes(activeProject.code);
  
  // Role-based sidebar filtering (permissions matrix from doc)
  // EE/RAA: Workflow, Ficha Semanal, Gestão de Resíduos, KPI's
  // RAP: Workflow, Ficha Semanal, KPI's (no Gestão de Resíduos)
  // PM: Workflow, Dashboard, Calendário, Fases, Timeline, Ficha Semanal, Gestão de Resíduos, KPI's
  // DO/Admin: everything
  // Observador: Dashboard, Ficha Semanal (read-only)
  const getFilteredMenuItems = () => {
    const visiblePaths = getVisibleNavigationPaths({
      role: userRole,
      isAllProjects,
      isOperationOnly,
      enabledModules: activeProject?.enabledModules,
      pmAccessModules: activeProject?.pmAccessModules,
      partnerAccess,
    });
    if (isAllProjects) {
      return allProjectsMenuItems.filter(item => visiblePaths.includes(item.path));
    }
    const menuItems = isOperationOnly ? operationProjectMenuItems : projectMenuItems;
    return menuItems.filter(item => visiblePaths.includes(item.path));
  };
  const baseMenuItems = getFilteredMenuItems();
  const visiblePaths = getVisibleNavigationPaths({
    role: userRole,
    isAllProjects,
    isOperationOnly,
    enabledModules: activeProject?.enabledModules,
    pmAccessModules: activeProject?.pmAccessModules,
    partnerAccess,
  });
  const allItems = [
    ...baseMenuItems,
    ...eeAdditionalMenuItems.filter(item => visiblePaths.includes(item.path)),
    ...(canAdmin ? adminMenuItems : []),
  ];
  const activeMenuItem = allItems.find((item) => location.startsWith(item.path));

  // NAV-01 FIX: Route guard — when project mode changes, if current route is not
  // in the new menu, redirect to Dashboard to avoid orphan pages
  useEffect(() => {
    if (location === "/" || location === "/login" || location === "/perfil" || location === "/admin") return;
    // A abertura direta de uma rota pode ocorrer antes de o contexto restaurar o
    // projeto ativo. Nesse intervalo, não existe informação suficiente para
    // decidir se a página é autorizada e um redirecionamento destruiria o URL.
    if (!isAllProjects && !activeProject) return;
    // Don't redirect if menu items haven't loaded yet or are empty
    if (allItems.length === 0) return;
    if (location === "/welcome" && userRole === "ee_partner") {
      setLocation(allItems[0].path);
      return;
    }
    if (location === "/welcome") return;
    const validPaths = allItems.map(item => item.path);
    const isCurrentRouteValid = validPaths.some(p => location.startsWith(p));
    if (!isCurrentRouteValid) {
      setLocation(userRole === "ee_partner" ? allItems[0].path : "/welcome");
    }
  }, [isAllProjects, activeProject?.id, isOperationOnly, location, userRole, partnerAccess?.allowKpi, partnerAccess?.allowWaste, activeProject]);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <img src={LOGO_URL} alt="Start Campus" className="h-6 object-contain" />
                  <span className="font-semibold tracking-tight truncate text-sm">
                    Plataforma de Gestão Ambiental
                  </span>
                  {userRole !== "ee_partner" && <NotificationBell />}
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Project Selector */}
            {!isCollapsed && projects.length > 0 && (
              <div className="px-3 py-2 border-b">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">
                  Projeto
                </label>
                <Select
                  value={isAllProjects ? "all" : String(activeProject?.id || "")}
                  onValueChange={(val) => setActiveProjectId(val === "all" ? null : parseInt(val, 10))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {canSeeAllProjects && (
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-3 w-3" />
                          <span>Todos os Projetos</span>
                        </div>
                      </SelectItem>
                    )}
                    {projects.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <span className="font-medium">{p.code}</span>
                        <span className="text-muted-foreground ml-1">— {p.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <SidebarMenu className="px-2 py-1">
              {allItems.map((item) => {
                const isActive = location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={t(item.label)}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{t(item.label)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 pb-14">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">{user?.email || "-"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {userRole !== "ee_partner" && <>
                  <DropdownMenuItem onClick={() => setLocation("/perfil")} className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>{t("Perfil")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowFeedback(true)} className="cursor-pointer">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    <span>{t("Deixar Feedback")}</span>
                  </DropdownMenuItem>
                </>}
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    void logout().finally(() => {
                      window.location.href = "/login";
                    });
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("Terminar Sessão")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground text-sm font-medium">
                {activeMenuItem?.label ?? "Menu"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 pb-16 overflow-auto">{children}</main>
      </SidebarInset>
      {/* 2FA Enforcement Overlay */}
      {needs2FA && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-orange-500" />
                Autenticação de Dois Fatores Obrigatória
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Para garantir a segurança dos dados ambientais, é obrigatório configurar a autenticação de dois fatores (2FA).
                Não poderá utilizar a plataforma até completar esta configuração.
              </p>
              {!qrData ? (
                <Button className="w-full" onClick={() => setup2FAMutation.mutate()} disabled={setup2FAMutation.isPending}>
                  <Shield className="h-4 w-4 mr-2" /> Configurar 2FA Agora
                </Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-medium">1. Digitalize com o Google/Microsoft Authenticator:</p>
                  <div className="flex justify-center">
                    <img src={qrData.qrCode} alt="QR Code 2FA" className="w-40 h-40 border rounded" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center break-all">Chave: {qrData.secret}</p>
                  <p className="text-sm font-medium">{t("2. Introduza o código de 6 dígitos:")}</p>
                  <div className="flex gap-2">
                    <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="font-mono text-lg tracking-widest" maxLength={6} />
                    <Button onClick={() => confirm2FAMutation.mutate({ code: totpCode })} disabled={totpCode.length !== 6 || confirm2FAMutation.isPending}>
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">{t("Não consegue aceder ao autenticador? Contacte")} <strong>apoioamb@startcampus.pt</strong></p>
                <button type="button" className="text-sm text-red-500 hover:underline w-full text-center" onClick={() => { window.location.href = "/api/auth/logout"; }}>
                  Terminar Sessão
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* English Translation Warning */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFeedback(false)}>
          <div className="bg-background rounded-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Deixar Feedback</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("Partilhe sugestões de melhoria ou reporte problemas.")}</p>
            <textarea className="w-full border rounded-md p-3 text-sm min-h-[100px] mb-3" placeholder="Descreva a sua sugestão ou problema..." value={feedbackText} onChange={e => setFeedbackText(e.target.value)} />
            <div className="mb-3">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Anexar fotografias (opcional)</label>
              <input type="file" accept="image/*" multiple className="text-xs" onChange={e => { if (e.target.files) setFeedbackPhotos(Array.from(e.target.files).slice(0, 5)); }} />
              {feedbackPhotos.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {feedbackPhotos.map((f, i) => (
                    <div key={i} className="relative w-16 h-16 border rounded overflow-hidden">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      <button className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-bl" onClick={() => setFeedbackPhotos(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1.5 text-sm rounded border hover:bg-muted" onClick={() => setShowFeedback(false)}>{t("Cancelar")}</button>
              <button className="px-3 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90" onClick={() => { if (feedbackText.trim()) { fetch("/api/trpc/feedback.create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ json: { content: feedbackText } }) }).then(() => { setShowFeedback(false); setFeedbackText(""); alert("Obrigado pelo feedback!"); }).catch(() => alert("Erro ao enviar.")); } }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationBell() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const notifQuery = trpc.notifications.pending.useQuery(undefined, {
    refetchInterval: 60000, // refresh every 60s
    staleTime: 30000,
  });
  const items = notifQuery.data?.items || [];
  const total = notifQuery.data?.totalCount || 0;

  const typeIcons: Record<string, string> = {
    review: "📋", rejected: "🔴", draft: "📝", access: "🔑", users: "👤",
  };
  const typeColors: Record<string, string> = {
    review: "text-blue-600", rejected: "text-red-600", draft: "text-amber-600",
    access: "text-purple-600", users: "text-green-600",
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors shrink-0 ml-auto" aria-label="Notificações">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 border-b">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            🔔 {t("Notificações")}
            {total > 0 && <span className="text-xs text-muted-foreground">({total})</span>}
          </h4>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("Sem notificações pendentes")}
            </div>
          ) : (
            items.map((item, i) => (
              <button
                key={i}
                onClick={() => setLocation(item.path)}
                className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b last:border-b-0 flex items-center gap-3"
              >
                <span className="text-lg">{typeIcons[item.type] || "📌"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${typeColors[item.type] || ""}`}>
                    {t(item.label)}
                  </p>
                </div>
                <span className="text-xs font-bold bg-muted rounded-full h-6 w-6 flex items-center justify-center shrink-0">
                  {item.count}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
