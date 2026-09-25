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
import { useLocation } from "wouter";
import { useState } from "react";
import {
  ClipboardList, BarChart3, CalendarDays, Recycle, FileBarChart,
  Shield, BookOpen, GitBranch, Layers, Heart, Play, Info, CheckCircle2,
  Quote, Leaf, ArrowRight, FileText, Send, Eye, XCircle, RotateCcw, ArrowDown
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
  const [, setLocation] = useLocation();
  const [videoPlaying, setVideoPlaying] = useState(false);
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
  const normalizedVideoUrl = videoUrl.includes("watch?v=")
    ? videoUrl.replace("watch?v=", "embed/")
    : videoUrl.includes("youtu.be/")
    ? videoUrl.replace("youtu.be/", "www.youtube.com/embed/")
    : videoUrl;
  const embedUrl = `${normalizedVideoUrl}${normalizedVideoUrl.includes("?") ? "&" : "?"}autoplay=1&mute=1&controls=1&playsinline=1&rel=0`;
  const welcomeImage = String((settingsQuery.data as any)?.image_dashboard || "/manus-storage/sc-aerial-2_18fcfe53.png");

  const visiblePaths = getVisibleNavigationPaths({
    role: userRole,
    isAllProjects,
    isOperationOnly: isNest,
    enabledModules: activeProject?.enabledModules,
    pmAccessModules: activeProject?.pmAccessModules,
    partnerAccess,
  });
  const features = getFeatures(userRole, visiblePaths);
  const roleLabel = ROLE_LABELS[userRole] || userRole;
  const projectName = isAllProjects ? "Todos os Projetos" : (activeProject?.name || projectCode);
  const userName = (user as any)?.name || (user as any)?.email?.split("@")[0] || "";

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        <StandPageHeader tone="operations" eyebrow="STAND · START CAMPUS" title={`${t("Obrigado por te juntares")}, ${userName}!`} description={t("Onde a sustentabilidade ganha posição")} context={projectName}>
          <div className="flex flex-wrap gap-2"><StandStatusBadge label={roleLabel} tone="info" /><StandStatusBadge label={isNest ? "NEST · Operação" : "Conformidade ambiental"} tone="success" /></div>
        </StandPageHeader>

        {/* Inspirational quote */}
        <div className="flex items-start gap-4 rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 dark:bg-primary/10">
          <Leaf className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-base italic text-foreground leading-relaxed">
              "Esta plataforma foi pensada para cada um de nós. Para que a informação esteja sempre atualizada, para que possamos tomar decisões mais conscientes e para que, juntos, consigamos reduzir ao máximo o nosso impacto ambiental. Cada dado que aqui registamos contribui para um futuro mais sustentável."
            </p>
            <p className="text-sm text-primary mt-2 font-semibold">{t("Equipa de Sustentabilidade, Start Campus")}</p>
          </div>
        </div>

        {/* Video + Features side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Vídeo institucional — preservado com poster fotográfico quando o fornecedor externo não responde. */}
          <Card className="stand-surface lg:col-span-2 overflow-hidden">
            <CardContent className="p-0">
              {videoPlaying ? (
                <div className="photo-grade-frame relative aspect-video w-full bg-[#0A3638]">
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={embedUrl}
                    title="Start Campus"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <button type="button" onClick={() => setVideoPlaying(false)} className="absolute right-3 top-3 z-10 rounded-lg border border-white/20 bg-[#0A3638]/85 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-[#0A3638]">{t("Voltar à imagem")}</button>
                </div>
              ) : (
                <button type="button" onClick={() => setVideoPlaying(true)} className="group relative block aspect-video w-full overflow-hidden bg-[#0A3638] text-left">
                  <img src={welcomeImage} alt={t("Vista institucional do campus Start Campus")} className="photo-grade absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.025]" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                  <span className="absolute inset-0 bg-[linear-gradient(120deg,rgba(10,54,56,.82),rgba(10,54,56,.2)_65%,rgba(10,54,56,.55))]" />
                  <span className="absolute inset-0 flex items-end justify-between gap-4 p-5 text-white sm:p-6">
                    <span><span className="stand-kicker text-primary">{t("A Start Campus em movimento")}</span><span className="mt-2 block max-w-xs text-lg font-semibold tracking-[-0.03em]">{t("Conheça a visão que liga campus, operação e sustentabilidade.")}</span></span>
                    <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/30 bg-card/12 backdrop-blur transition group-hover:scale-105 group-hover:bg-primary group-hover:text-[#0A3638]"><Play className="ml-0.5 size-5 fill-current" /></span>
                  </span>
                </button>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-surface-dashboard/70 px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-2"><Play className="size-3.5 text-primary" />{t("Vídeo institucional da Start Campus")}</span>
                <a href={videoUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">{t("Abrir no fornecedor")}</a>
              </div>
            </CardContent>
          </Card>

          {/* What you can do - 3/5 width */}
          <Card className="stand-surface lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="w-4 h-4 text-primary" />
                {isAllProjects
                  ? t("O que pode fazer na visão global")
                  : `${t("O que pode fazer em")} ${projectName}`
                }
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isAllProjects
                  ? t("Visão consolidada de todos os projetos Start Campus.")
                  : isNest
                  ? t("Projeto em fase de operação: desempenho do edifício, entregáveis ambientais, resíduos e certificações.")
                  : t("Acompanhamento do cumprimento das medidas ambientais da DCAPE durante a construção.")
                }
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map((feature, i) => (
                  <button type="button" key={i} onClick={() => setLocation(feature.path)} className="stand-interactive flex gap-3 rounded-xl border bg-card p-3 text-left transition-colors group">
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <feature.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className="font-semibold text-sm">{t(feature.title)}</h3>
                        <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{t(feature.description)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick tips */}
        {/* Workflow Diagram - How the process works */}
        {!isAllProjects && !isNest && visiblePaths.includes("/ficha") && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="w-4 h-4 text-primary" />
                {t("Fluxo de Submissão")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("Como funciona o processo de submissão e aprovação das fichas de controlo ambiental.")}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-0 py-2">
                <WelcomeFlowStep icon={<FileText className="w-4 h-4" />} title={t("1. Criação da Ficha")} desc="EE/RAP preenche a ficha semanal" color="submissao" actor="EE / RAP" />
                <ArrowDown className="w-4 h-4 text-muted-foreground my-1" />
                <WelcomeFlowStep icon={<Send className="w-4 h-4" />} title={t("2. Submissão")} desc={t("Ficha submetida para revisão")} color="revisao" actor="EE / RAP" />
                <ArrowDown className="w-4 h-4 text-muted-foreground my-1" />
                <WelcomeFlowStep icon={<Eye className="w-4 h-4" />} title={t("3. Revisão pela RAA")} desc={t("RAA analisa e verifica conformidade")} color="decisao" actor="RAA" />
                <ArrowDown className="w-4 h-4 text-muted-foreground my-1" />
                <div className="w-full max-w-lg border-2 border-dashed border-muted-foreground/30 rounded-xl p-3 bg-muted/20">
                  <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("Decisão da RAA")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 rounded-lg border border-primary/30 bg-primary/10">
                      <CheckCircle2 className="w-5 h-5 text-primary mx-auto mb-1" />
                      <p className="text-xs font-semibold text-[#0A3638]">{t("Aprovada")}</p>
                      <p className="text-[10px] text-[#0A3638]/75 mt-0.5">{t("Arquivada no histórico")}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-red-50 border border-red-200">
                      <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-red-800">{t("Rejeitada")}</p>
                      <p className="text-[10px] text-red-700 mt-0.5">{t("Volta para rascunhos")}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t flex flex-wrap gap-3 justify-center text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0A3638]" /> {t("Ação EE/RAP")}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6D7A70]" /> {t("Ação RAA")}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> {t("Aprovado")}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {t("Rejeitado")}</span>
              </div>
              {/* Entity roles legend */}
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("Entidades no Processo")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#F4F4FF] border border-[#0A3638]/15">
                    <span className="text-xs font-bold text-[#0A3638] bg-card px-1.5 py-0.5 rounded mt-0.5">EE</span>
                    <div>
                      <p className="text-xs font-medium text-[#272726]">{t("Entidade Executante")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("Cria e submete fichas semanais")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#F4F4FF] border border-[#0A3638]/15">
                    <span className="text-xs font-bold text-[#0A3638] bg-card px-1.5 py-0.5 rounded mt-0.5">RAP</span>
                    <div>
                      <p className="text-xs font-medium text-[#272726]">{t("Resp. Ambiental Projeto")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("Submete fichas da sua responsabilidade")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#EDEBEB] border border-border">
                    <span className="text-xs font-bold text-[#272726] bg-card px-1.5 py-0.5 rounded mt-0.5">RAA</span>
                    <div>
                      <p className="text-xs font-medium text-[#272726]">{t("Resp. Ambiental Atividade")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("Revê, aprova ou rejeita fichas")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/25">
                    <span className="text-xs font-bold text-[#0A3638] bg-primary px-1.5 py-0.5 rounded mt-0.5">DO</span>
                    <div>
                      <p className="text-xs font-medium text-[#272726]">{t("Dono de Obra")}</p>
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
          <div className="flex gap-3 items-start p-4 rounded-xl bg-[#F4F4FF] border border-[#0A3638]/15 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-[#0A3638] text-white flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm">1</div>
            <div>
              <p className="text-sm font-medium text-[#272726] mb-0.5">{ t("Menu lateral") }</p>
              <p className="text-xs text-muted-foreground">{t("Navegue entre as secções da plataforma usando o menu à esquerda.")}</p>
            </div>
          </div>
          <div className="flex gap-3 items-start p-4 rounded-xl bg-primary/10 border border-primary/25 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-primary text-[#0A3638] flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm">2</div>
            <div>
              <p className="text-sm font-medium text-[#272726] mb-0.5">
                {userRole === "ee" || userRole === "rap" ? "Fichas semanais" : userRole === "raa" ? "Revisão" : "Dashboard"}
              </p>
              <p className="text-xs text-muted-foreground">
                {userRole === "ee" || userRole === "rap"
                  ? "Submeta atempadamente para evitar alertas."
                  : userRole === "raa"
                  ? "Reveja e forneça feedback detalhado."
                  : "Consulte o estado de cumprimento."
                }
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start p-4 rounded-xl bg-[#EDEBEB] border border-border shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-[#6D7A70] text-white flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm">3</div>
            <div>
              <p className="text-sm font-medium text-[#272726] mb-0.5">{ t("Suporte") }</p>
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
    submissao: "bg-[#F4F4FF] border-[#0A3638]/18 text-[#0A3638]",
    revisao: "bg-[#EDEBEB] border-border text-[#272726]",
    decisao: "bg-primary/10 border-primary/25 text-[#0A3638]",
  };
  const badges: Record<string, string> = {
    submissao: "bg-card text-[#0A3638]",
    revisao: "bg-card text-[#272726]",
    decisao: "bg-primary text-[#0A3638]",
  };
  return (
    <div className={`w-full max-w-lg p-3 rounded-lg border ${colors[color]} flex items-center gap-3`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-80">{desc}</p>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badges[color]}`}>{actor}</span>
    </div>
  );
}
