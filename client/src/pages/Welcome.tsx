import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "../contexts/ProjectContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { getVisibleNavigationPaths } from "@/lib/role-navigation";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import { StandStatusBadge } from "@/components/stand/StandStatusBadge";
import { useBrandImage } from "@/hooks/useBrandImage";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  ClipboardList, BarChart3, CalendarDays, Recycle, FileBarChart,
  Shield, BookOpen, GitBranch, Layers, Heart, Play, Info, CheckCircle2,
  Quote, Leaf, ArrowRight, FileText, Send, Eye, XCircle, RotateCcw, ArrowDown,
  Activity, Building2, Database, Gauge, LockKeyhole, RadioTower, Server, Workflow
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  dono_obra: "Dono de Obra",
  pm: "Gestor de Projeto",
  ee: "Entidade Executante (EE)",
  rap: "Responsável Ambiental do Projeto (RAP)",
  raa: "Responsável Ambiental da Atividade (RAA)",
  observador: "Observador",
  user: "Utilizador",
};

interface FeatureCard {
  icon: React.ElementType;
  title: string;
  description: string;
  path: string;
}

function getFeatures(role: string, visiblePaths: string[]): FeatureCard[] {
  const descriptionFicha = role === "ee"
    ? "Crie e submeta fichas de controlo semanais com as medidas ambientais atribuídas à sua empresa."
    : role === "rap"
    ? "Submeta fichas de controlo semanais relativas às medidas ambientais da sua responsabilidade."
    : role === "raa"
    ? "Reveja as fichas submetidas pelas entidades executantes. Aprove ou rejeite com comentários por medida."
    : "Crie, submeta e acompanhe fichas de controlo semanais. Consulte a matriz e o histórico completo.";
  const catalogue: FeatureCard[] = [
    { icon: Shield, title: "Dashboard", description: "Visão geral do cumprimento ambiental e dos alertas aplicáveis ao seu perfil.", path: "/dashboard" },
    { icon: ClipboardList, title: "Ficha Semanal", description: descriptionFicha, path: "/ficha" },
    { icon: Recycle, title: "Gestão de Resíduos", description: "Registe e consulte resíduos dentro do âmbito permitido à sua entidade.", path: "/residuos" },
    { icon: BarChart3, title: "KPI's", description: "Submeta e consulte indicadores de sustentabilidade no âmbito autorizado.", path: "/kpi" },
    { icon: CalendarDays, title: "Calendário", description: "Consulte os prazos de reporting ambiental e as datas importantes do projeto.", path: "/calendario" },
    { icon: GitBranch, title: "Timeline", description: "Acompanhe o progresso das fases do projeto dentro do seu âmbito de acesso.", path: "/timeline" },
    { icon: BarChart3, title: "Dashboard Parceiros", description: "Acompanhe os contributos KPI e resíduos da sua EE e das EEP autorizadas.", path: "/dashboard-parceiros" },
    { icon: ClipboardList, title: "Pedidos EEP", description: "Submeta pedidos de criação e acesso para Entidades Executantes Parceiras.", path: "/pedidos-eep" },
    { icon: Recycle, title: "MIRR", description: "Registe e acompanhe os resíduos do projeto, incluindo e-GAR e exportação MIRR.", path: "/mirr" },
    { icon: BarChart3, title: "Operação", description: "Analise consumos, eficiência, água do mar, faturas e cenários de desempenho do edifício NEST.", path: "/operacao" },
    { icon: Layers, title: "Fases de Exploração", description: "Submeta evidências anuais das medidas de exploração da DCAPE.", path: "/fases" },
    { icon: FileBarChart, title: "Certificações", description: "Acompanhe as certificações ambientais do projeto.", path: "/certificacoes" },
    { icon: BookOpen, title: "Documentação", description: "Consulte obrigações ambientais, certificações e recomendações publicadas pela Administração.", path: "/documentacao" },
    { icon: FileBarChart, title: "RDCD", description: "Gere relatórios de demonstração de cumprimento da DCAPE.", path: "/rdcd" },
    { icon: Heart, title: "GAMMA", description: "Consulte candidaturas, avaliações e projetos vencedores do programa GAMMA.", path: "/gamma" },
    { icon: ClipboardList, title: "Planos", description: "Consulte planos de monitorização, responsáveis, atualizações e prazos de reporting.", path: "/planos" },
  ];
  return catalogue.filter(feature => visiblePaths.includes(feature.path));
}

export default function Welcome() {
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const { t } = useLanguage();
  const welcomeHeaderImage = useBrandImage("welcome");
  const operationsImage = useBrandImage("operacao");
  const timelineImage = useBrandImage("timeline");
  const [, setLocation] = useLocation();
  // Autoplay é permitido de forma fiável em browsers quando o vídeo inicia sem som.
  // A fotografia institucional permanece disponível no controlo "Voltar à imagem".
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [selectedRackPath, setSelectedRackPath] = useState<string>("");
  const videoFrameRef = useRef<HTMLIFrameElement | null>(null);
  const userRole = (user as any)?.role || "user";
  const projectCode = activeProject?.code || "";
  const isNest = projectCode === "SIN01";
  const { data: partnerAccess } = trpc.partners.myAccess.useQuery(undefined, { enabled: userRole === "ee_partner" });

  const settingsQuery = trpc.appSettings.getAll.useQuery(undefined, {
    enabled: userRole !== "ee_partner",
  });
  // Mantém o vídeo institucional ligado por defeito. A Administração pode
  // substituí-lo por URL configurada, mas uma configuração vazia nunca troca o
  // conteúdo existente por um bloco de placeholder.
  const videoUrl = String((settingsQuery.data as any)?.welcomeVideoUrl || "https://www.youtube.com/embed/IsjSfMUIWzE").trim();
  const normalizedVideoUrl = (videoUrl.includes("watch?v=")
    ? videoUrl.replace("watch?v=", "embed/")
    : videoUrl.includes("youtu.be/")
    ? videoUrl.replace("youtu.be/", "www.youtube.com/embed/")
    : videoUrl).replace("www.youtube.com/embed/", "www.youtube-nocookie.com/embed/");
  const embedUrl = `${normalizedVideoUrl}${normalizedVideoUrl.includes("?") ? "&" : "?"}autoplay=1&mute=1&controls=1&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  // A mesma resolução usada no cabeçalho é também o poster do vídeo.  Assim uma
  // alteração feita na Administração não deixa um URL antigo/quebrado apenas na
  // página Bem-vindo.
  const welcomeImage = welcomeHeaderImage.url;

  const visiblePaths = getVisibleNavigationPaths({
    role: userRole,
    isAllProjects,
    isOperationOnly: isNest,
    enabledModules: activeProject?.enabledModules,
    pmAccessModules: activeProject?.pmAccessModules,
    partnerAccess,
  });
  const features = getFeatures(userRole, visiblePaths);
  const roleLabel = t(ROLE_LABELS[userRole] || userRole);
  const projectName = isAllProjects ? t("Todos os Projetos") : (activeProject?.name || projectCode);
  const userName = (user as any)?.name || (user as any)?.email?.split("@")[0] || "";
  const primaryPath = isNest && visiblePaths.includes("/operacao") ? "/operacao" : "/dashboard";
  const primaryLabel = isNest ? t("Abrir operação NEST") : t("Abrir centro de controlo");
  const quickCommands = features.slice(0, 8);
  const rackPathSignature = quickCommands.map((feature) => feature.path).join("|");
  const selectedRackFeature = quickCommands.find((feature) => feature.path === selectedRackPath) || quickCommands[0];

  useEffect(() => {
    if (!videoPlaying) return;
    setVideoReady(false);
    const handlePlayerMessage = (event: MessageEvent) => {
      if (!/youtube(?:-nocookie)?\.com$/.test(new URL(event.origin).hostname)) return;
      try {
        const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (payload?.event === "onStateChange" && [1, 3].includes(payload?.info)) setVideoReady(true);
      } catch {
        // Mensagens não estruturadas do fornecedor são ignoradas.
      }
    };
    window.addEventListener("message", handlePlayerMessage);
    return () => window.removeEventListener("message", handlePlayerMessage);
  }, [videoPlaying, embedUrl]);

  useEffect(() => {
    if (!quickCommands.some((feature) => feature.path === selectedRackPath) && quickCommands[0]?.path) {
      setSelectedRackPath(quickCommands[0].path);
    }
  }, [selectedRackPath, rackPathSignature]);

  return (
    <AppLayout>
      <div className="stand-command-shell space-y-6 pb-8">
        <section className="stand-os-hero" aria-label={t("Centro de comando STAND")}>
          <img className="stand-os-hero-image" src={welcomeHeaderImage.url} alt="" style={{ objectPosition: welcomeHeaderImage.position }} />
          <div className="stand-os-hero-wash" />
          <div className="stand-os-scanline" aria-hidden="true" />
          <div className="stand-os-hero-top">
            <div className="stand-os-brandline"><span className="status-dot success ops-glow-dot" /><span>STAND_OS</span><span className="opacity-45">/</span><span>{t("Centro de comando ambiental")}</span></div>
            <div className="stand-os-topmeta"><span>{projectName}</span><span className="stand-os-live"><span className="status-dot success" />{t("Sessão protegida")}</span></div>
          </div>
          <div className="stand-os-hero-core">
            <div className="stand-os-hero-copy">
              <p className="stand-kicker text-primary">{t(isNest ? "NEST · SIN01 · OPERAÇÃO" : "START CAMPUS · GOVERNAÇÃO AMBIENTAL")}</p>
              {userName && <p className="stand-os-greeting">{t("Bem-vindo de volta")}, <strong>{userName}</strong>.</p>}
              <h1>{t("Governança ambiental, com rigor em cada decisão.")}</h1>
              <p>{t("Cada registo liga a operação, a conformidade e decisões ambientais mais conscientes.")}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => setLocation(primaryPath)} className="stand-os-primary-action"><Activity className="size-4" />{primaryLabel}<ArrowRight className="size-4" /></button>
                {visiblePaths.includes("/timeline") && <button type="button" onClick={() => setLocation("/timeline")} className="stand-os-secondary-action"><Workflow className="size-4" />{t("Ver ciclo do projeto")}</button>}
              </div>
            </div>
            <aside className="stand-os-status-module" aria-label={t("Estado do ambiente de trabalho")}>
              <div className="stand-os-module-head"><RadioTower className="size-4 text-primary" /><span>{t("Ambiente de trabalho")}</span><span className="ml-auto stand-os-code">01</span></div>
              <div className="stand-os-module-value">{isNest ? "NEST / SIN01" : projectName}</div>
              <div className="stand-os-module-rule" />
              <div className="stand-os-module-list">
                <div><span>{t("Perfil")}</span><strong>{roleLabel}</strong></div>
                <div><span>{t("Âmbito ativo")}</span><strong>{isAllProjects ? t("Portefólio") : projectCode}</strong></div>
                <div><span>{t("Controlo de acesso")}</span><strong>{t("RBAC ativo")}</strong></div>
              </div>
              <div className="stand-os-ports" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} className={index === 1 || index === 7 ? "is-live" : ""} />)}</div>
            </aside>
          </div>
          <div className="stand-os-hero-bottom">
            <div><Building2 className="size-4" /><span>{t("Fotografia institucional Start Campus")}</span></div>
            <div><LockKeyhole className="size-4" /><span>{t("Acesso auditado por papel, empresa e projeto")}</span></div>
            <div><Database className="size-4" /><span>{t("Dados e evidências com origem rastreável")}</span></div>
          </div>
        </section>

        <section className="stand-os-command-grid" aria-label={t("Acessos rápidos") }>
          <button type="button" className="stand-os-visual-command stand-os-visual-command--operations" onClick={() => setLocation(isNest && visiblePaths.includes("/operacao") ? "/operacao" : "/dashboard")}>
            <img src={operationsImage.url} alt="" style={{ objectPosition: operationsImage.position }} />
            <span className="stand-os-command-scrim" />
            <span className="stand-os-command-content"><span className="stand-os-code">SYS.01</span><strong>{t("Edifício, sistemas e eficiência")}</strong><small>{t("Da infraestrutura aos sinais de operação")}</small></span><span className="stand-os-arrow"><ArrowRight className="size-4" /></span>
          </button>
          <button type="button" className="stand-os-visual-command stand-os-visual-command--delivery" onClick={() => setLocation(visiblePaths.includes("/timeline") ? "/timeline" : "/dashboard")}>
            <img src={timelineImage.url} alt="" style={{ objectPosition: timelineImage.position }} />
            <span className="stand-os-command-scrim" />
            <span className="stand-os-command-content"><span className="stand-os-code">PRJ.02</span><strong>{t("Fases, equipas e evidências")}</strong><small>{t("Cumprimento DCAPE ponto a ponto")}</small></span><span className="stand-os-arrow"><ArrowRight className="size-4" /></span>
          </button>
          <div className="stand-os-trust-panel"><span className="stand-os-code">STAND / START CAMPUS</span><p>{t("Uma plataforma de conformidade que se comporta como um sistema de missão crítica.")}</p><div><Shield className="size-4 text-primary" /><span>{t("Permissões, histórico e fontes visíveis")}</span></div></div>
        </section>

        {/* Video + Features side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Vídeo institucional — preservado com poster fotográfico quando o fornecedor externo não responde. */}
          <Card className="stand-surface stand-welcome-video lg:col-span-2 overflow-hidden">
            <CardContent className="p-0">
              {videoPlaying ? (
                <div className="photo-grade-frame relative aspect-video w-full bg-surface-contrast">
                  <img src={welcomeImage} alt="" aria-hidden="true" className="photo-grade absolute inset-0 size-full object-cover" />
                  <span className={`absolute inset-0 bg-[linear-gradient(120deg,rgba(10,54,56,.7),rgba(10,54,56,.12)_65%,rgba(10,54,56,.55))] transition-opacity duration-300 ${videoReady ? "opacity-0" : "opacity-100"}`} />
                  <iframe
                    ref={videoFrameRef}
                    className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${videoReady ? "opacity-100" : "opacity-0"}`}
                    src={embedUrl}
                    title="Start Campus"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => {
                      // O browser pode bloquear autoplay até receber o comando do
                      // próprio player. O poster só desaparece quando há estado
                      // de reprodução real, nunca apenas ao carregar o iframe.
                      const player = videoFrameRef.current?.contentWindow;
                      const target = new URL(embedUrl).origin;
                      const send = (payload: unknown) => player?.postMessage(JSON.stringify(payload), target);
                      // O host do iframe é youtube-nocookie.com (e não a URL
                      // pública normalizada do vídeo); usar o mesmo host é
                      // necessário para o browser aceitar postMessage.
                      send({ event: "listening" });
                      send({ event: "command", func: "addEventListener", args: ["onStateChange"] });
                      const startPlayback = () => {
                        send({ event: "command", func: "mute", args: [] });
                        send({ event: "command", func: "playVideo", args: [] });
                      };
                      // O player pode ainda estar a inicializar quando o iframe
                      // termina de carregar. Repetimos o comando em janelas
                      // curtas, sem revelar um frame vazio se o fornecedor não
                      // confirmar reprodução.
                      [180, 700, 1400].forEach((delay) => window.setTimeout(startPlayback, delay));
                    }}
                  />
                  <button type="button" onClick={() => setVideoPlaying(false)} className="absolute right-3 top-3 z-10 rounded-lg border border-white/20 bg-surface-contrast/85 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-surface-contrast">{t("Voltar à imagem")}</button>
                </div>
              ) : (
                <button type="button" onClick={() => setVideoPlaying(true)} className="group relative block aspect-video w-full overflow-hidden bg-surface-contrast text-left">
                  <img src={welcomeImage} alt={t("Vista institucional do campus Start Campus")} className="photo-grade absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.025]" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                  <span className="absolute inset-0 bg-[linear-gradient(120deg,rgba(10,54,56,.82),rgba(10,54,56,.2)_65%,rgba(10,54,56,.55))]" />
                  <span className="absolute inset-0 flex items-end justify-between gap-4 p-5 text-white sm:p-6">
                    <span><span className="stand-kicker text-primary">{t("A Start Campus em movimento")}</span><span className="mt-2 block max-w-xs text-lg font-semibold tracking-[-0.03em]">{t("Conheça a visão que liga campus, operação e sustentabilidade.")}</span></span>
                    <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/30 bg-card/12 backdrop-blur transition group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground"><Play className="ml-0.5 size-5 fill-current" /></span>
                  </span>
                </button>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-surface-dashboard/70 px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-2"><Play className="size-3.5 text-primary" />{t("Vídeo institucional da Start Campus")}</span>
                <a href={videoUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">{t("Abrir no fornecedor")}</a>
              </div>
            </CardContent>
          </Card>

          <Card className="stand-access-rack lg:col-span-3">
            <CardHeader className="stand-rack-header">
              <div>
                <p className="stand-kicker text-primary">{t("ACESSO POR PERFIL")}</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-base"><Server className="size-4 text-primary" />{t("A sua rack de trabalho")}</CardTitle>
              </div>
              <span className="stand-rack-access-badge"><LockKeyhole className="size-3" />{quickCommands.length} {t("gavetas autorizadas")}</span>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="stand-rack-workspace">
                <div className="stand-rack-slots" aria-label={t("Módulos autorizados")}>{quickCommands.map((feature, index) => {
                  const isSelected = feature.path === selectedRackFeature?.path;
                  return <button type="button" key={feature.path} aria-pressed={isSelected} onClick={() => setSelectedRackPath(feature.path)} className={`stand-rack-drawer ${isSelected ? "is-open" : ""}`}>
                    <span className="stand-rack-slot-index">{String(index + 1).padStart(2, "0")}</span>
                    <feature.icon className="size-4" />
                    <span className="truncate">{t(feature.title)}</span>
                    <i aria-hidden="true" />
                  </button>;
                })}</div>
                <aside className="stand-rack-inspector" aria-live="polite">
                  {selectedRackFeature && <>
                    <div className="stand-rack-inspector-icon"><selectedRackFeature.icon className="size-5" /></div>
                    <span className="stand-os-code">{t("GAVETA ATIVA")}</span>
                    <h3>{t(selectedRackFeature.title)}</h3>
                    <p>{t(selectedRackFeature.description)}</p>
                    <button type="button" onClick={() => setLocation(selectedRackFeature.path)} className="stand-rack-open-action">{t("Abrir módulo")}<ArrowRight className="size-4" /></button>
                  </>}
                </aside>
              </div>
              <p className="stand-rack-footnote"><LockKeyhole className="size-3.5" />{t("Só são apresentadas gavetas autorizadas pelo seu perfil, empresa e projeto.")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick tips */}
        {/* Workflow Diagram - How the process works */}
        {!isAllProjects && !isNest && visiblePaths.includes("/ficha") && (
          <Card className="stand-flow-console">
            <CardHeader className="stand-flow-header">
              <div>
                <p className="stand-kicker text-primary">{t("SEQUÊNCIA CONTROLADA")}</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-base"><BookOpen className="w-4 h-4 text-primary" />{t("Fluxo de Submissão")}</CardTitle>
              </div>
              <p className="max-w-xl text-xs text-muted-foreground">{t("Cada ficha é submetida, revista e decidida no mesmo percurso rastreável — sem aprovações cruzadas.")}</p>
            </CardHeader>
            <CardContent>
              <div className="stand-flow-track">
                <WelcomeFlowStep icon={<FileText className="w-4 h-4" />} title={t("1. Criação da Ficha")} desc={t("EE/RAP preenche a ficha semanal")} color="submissao" actor="EE / RAP" />
                <ArrowRight className="stand-flow-arrow size-5" />
                <WelcomeFlowStep icon={<Send className="w-4 h-4" />} title={t("2. Submissão")} desc={t("Ficha submetida para revisão")} color="revisao" actor="EE / RAP" />
                <ArrowRight className="stand-flow-arrow size-5" />
                <WelcomeFlowStep icon={<Eye className="w-4 h-4" />} title={t("3. Revisão pela RAA")} desc={t("RAA analisa e verifica conformidade")} color="decisao" actor="RAA" />
                <ArrowRight className="stand-flow-arrow size-5" />
                <div className="stand-flow-decision">
                  <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("Decisão da RAA")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 rounded-lg border border-primary/30 bg-primary/10">
                      <CheckCircle2 className="w-5 h-5 text-primary mx-auto mb-1" />
                      <p className="text-xs font-semibold text-foreground">{t("Aprovada")}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t("Arquivada no histórico")}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-red-50 border border-red-200">
                      <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-red-800">{t("Rejeitada")}</p>
                      <p className="text-[10px] text-red-700 mt-0.5">{t("Volta para rascunhos")}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t flex flex-wrap gap-3 justify-center text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-2" /> {t("Ação EE/RAP")}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-3" /> {t("Ação RAA")}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> {t("Aprovado")}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {t("Rejeitado")}</span>
              </div>
              {/* Entity roles legend */}
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("Entidades no Processo")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent border border-primary/20">
                    <span className="text-xs font-bold text-foreground bg-card px-1.5 py-0.5 rounded mt-0.5">EE</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{t("Entidade Executante")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("Cria e submete fichas semanais")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent border border-primary/20">
                    <span className="text-xs font-bold text-foreground bg-card px-1.5 py-0.5 rounded mt-0.5">RAP</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{t("Resp. Ambiental Projeto")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("Submete fichas da sua responsabilidade")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted border border-border">
                    <span className="text-xs font-bold text-foreground bg-card px-1.5 py-0.5 rounded mt-0.5">RAA</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{t("Resp. Ambiental Atividade")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("Revê, aprova ou rejeita fichas")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/25">
                    <span className="text-xs font-bold text-primary-foreground bg-primary px-1.5 py-0.5 rounded mt-0.5">DO</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{t("Dono de Obra")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("Visão completa e gestão de acessos")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick tips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex gap-3 items-start p-4 rounded-xl bg-accent border border-primary/20 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-surface-contrast text-white flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm">1</div>
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">{ t("Menu lateral") }</p>
              <p className="text-xs text-muted-foreground">{t("Navegue entre as secções da plataforma usando o menu à esquerda.")}</p>
            </div>
          </div>
          <div className="flex gap-3 items-start p-4 rounded-xl bg-primary/10 border border-primary/25 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm">2</div>
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">
                {t(userRole === "ee" || userRole === "rap" ? "Fichas semanais" : userRole === "raa" ? "Revisão" : "Dashboard")}
              </p>
              <p className="text-xs text-muted-foreground">
                {userRole === "ee" || userRole === "rap"
                  ? t("Submeta atempadamente para evitar alertas.")
                  : userRole === "raa"
                  ? t("Reveja e forneça feedback detalhado.")
                  : t("Consulte o estado de cumprimento.")
                }
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start p-4 rounded-xl bg-muted border border-border shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-surface-contrast text-white flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm">3</div>
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">{ t("Suporte") }</p>
              <p className="text-xs text-muted-foreground">{t("Contacte apoioamb@startcampus.pt ou use Deixar Feedback.")}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function WelcomeFlowStep({ icon, title, desc, color, actor }: { icon: React.ReactNode; title: string; desc: string; color: string; actor: string }) {
  const colors: Record<string, string> = {
    submissao: "bg-accent border-primary/20 text-foreground",
    revisao: "bg-muted border-border text-foreground",
    decisao: "bg-primary/10 border-primary/25 text-foreground",
  };
  const badges: Record<string, string> = {
    submissao: "bg-card text-foreground",
    revisao: "bg-card text-foreground",
    decisao: "bg-primary text-primary-foreground",
  };
  return (
    <div className={`stand-flow-step ${colors[color]} flex items-center gap-3`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-80">{desc}</p>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badges[color]}`}>{actor}</span>
    </div>
  );
}
