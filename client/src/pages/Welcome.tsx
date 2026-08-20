import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "../contexts/ProjectContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  ClipboardList, BarChart3, CalendarDays, Recycle, FileBarChart,
  Shield, BookOpen, GitBranch, Layers, Heart, Play, Info, CheckCircle2,
  Quote, Leaf, ArrowRight
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  dono_obra: "Dono de Obra",
  pm: "Project Manager",
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
}

function getFeatures(role: string, projectCode: string, isAllProjects: boolean, isNest: boolean): FeatureCard[] {
  if (isAllProjects) {
    return [
      { icon: ClipboardList, title: "Dashboard Global", description: "Visão geral do cumprimento ambiental de todos os projetos Start Campus." },
      { icon: CalendarDays, title: "Calendário Integrado", description: "Consulte todos os prazos regulatórios e internos de reporting num único calendário." },
      { icon: GitBranch, title: "Timeline de Projetos", description: "Acompanhe o progresso de cada projeto e em que fase se encontra." },
      { icon: FileBarChart, title: "RDCD", description: "Gere relatórios de demonstração de cumprimento da DCAPE." },
      { icon: Heart, title: "GAMMA", description: "Programa comunitário GAMMA — candidaturas, avaliações e projetos vencedores." },
    ];
  }
  if (isNest) {
    const features: FeatureCard[] = [
      { icon: CalendarDays, title: "Calendário de Reporting", description: "Consulte e atualize os prazos de reporting ambiental — MIRR, gases fluorados, medidas de operação e outros entregáveis." },
      { icon: Recycle, title: "MIRR", description: "Registe e acompanhe os resíduos do projeto. Importe e-GARs, gere o Wastemap e exporte o MIRR anual." },
      { icon: Layers, title: "Fases de Exploração", description: "Submeta evidências anuais das medidas de exploração da DCAPE, organizadas por ano." },
      { icon: FileBarChart, title: "Certificações", description: "Acompanhe as certificações LEED O&M, EED e CELE com submissão de evidências." },
    ];
    if (role === "admin" || role === "dono_obra") {
      features.unshift({ icon: Shield, title: "Dashboard SIN01", description: "Visão geral dos indicadores de operação, resíduos e certificações do projeto NEST." });
    }
    return features;
  }
  const features: FeatureCard[] = [];
  if (["admin", "dono_obra", "pm"].includes(role)) {
    features.push({ icon: Shield, title: "Dashboard", description: "Visão geral do cumprimento ambiental — fichas aprovadas, em revisão, rascunhos e alertas de incumprimento." });
  }
  if (["admin", "dono_obra", "pm", "ee", "raa", "rap"].includes(role)) {
    features.push({ icon: BookOpen, title: "Workflow", description: "Consulte o fluxo de submissão e aprovação das fichas de controlo ambiental." });
    features.push({
      icon: ClipboardList,
      title: "Ficha Semanal",
      description: role === "ee"
        ? "Crie e submeta fichas de controlo semanais com as medidas ambientais atribuídas à sua empresa."
        : role === "rap"
        ? "Submeta fichas de controlo semanais relativas às medidas ambientais da sua responsabilidade."
        : role === "raa"
        ? "Reveja as fichas submetidas pelas entidades executantes. Aprove ou rejeite com comentários por medida."
        : "Crie, submeta e acompanhe fichas de controlo semanais. Consulte a matriz e o histórico completo."
    });
  }
  if (["admin", "dono_obra", "pm", "ee", "raa"].includes(role)) {
    features.push({ icon: Recycle, title: "Gestão de Resíduos", description: "Registe resíduos por código LER, crie sub-projetos, gere Wastemap e exporte MIRR." });
  }
  if (["admin", "dono_obra", "pm", "ee", "rap"].includes(role)) {
    features.push({ icon: BarChart3, title: "KPI's", description: "Submeta dados semanais de sustentabilidade — trabalhadores, consumos de energia, água e incidentes." });
  }
  features.push({ icon: CalendarDays, title: "Calendário", description: "Consulte os prazos de reporting ambiental e as datas importantes do projeto." });
  features.push({ icon: GitBranch, title: "Timeline", description: "Acompanhe o progresso das fases do projeto — desde o pré-licenciamento até à operação." });
  return features;
}

export default function Welcome() {
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const { t } = useLanguage();
  const userRole = (user as any)?.role || "user";
  const projectCode = activeProject?.code || "";
  const isNest = projectCode === "SIN01";

  const settingsQuery = trpc.appSettings.getAll.useQuery();
  const videoUrl = (settingsQuery.data as any)?.welcomeVideoUrl || "https://www.youtube.com/embed/IsjSfMUIWzE";
  const embedUrl = (videoUrl.includes("watch?v=")
    ? videoUrl.replace("watch?v=", "embed/")
    : videoUrl.includes("youtu.be/")
    ? videoUrl.replace("youtu.be/", "www.youtube.com/embed/")
    : videoUrl) + "?autoplay=1&mute=1&loop=1&controls=1";

  const features = getFeatures(userRole, projectCode, isAllProjects, isNest);
  const roleLabel = ROLE_LABELS[userRole] || userRole;
  const projectName = isAllProjects ? "Todos os Projetos" : (activeProject?.name || projectCode);
  const userName = (user as any)?.name || (user as any)?.email?.split("@")[0] || "";

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Hero Section with welcome message */}
        <div className="rounded-xl overflow-hidden border bg-gradient-to-br from-green-800 via-emerald-700 to-teal-600 text-white p-8 relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10 max-w-3xl">
            <p className="text-emerald-200 text-sm font-medium mb-2 uppercase tracking-wider">
              Plataforma de Gestão Ambiental — Start Campus
            </p>
            <h1 className="text-3xl font-bold mb-3">
              Obrigado por te juntares, {userName}!
            </h1>
            <div className="flex gap-2 flex-wrap mb-5">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
                {roleLabel}
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
                {projectName}
              </Badge>
            </div>
          </div>
        </div>

        {/* Inspirational quote */}
        <div className="flex items-start gap-4 p-5 rounded-xl border-l-4 border-emerald-500 bg-emerald-50/50">
          <Leaf className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-base italic text-emerald-900 leading-relaxed">
              "É importante termos a informação atualizada, para tomarmos decisões informadas, com o menor impacto ambiental possível."
            </p>
            <p className="text-sm text-emerald-700 mt-2 font-medium">— Equipa de Sustentabilidade, Start Campus</p>
          </div>
        </div>

        {/* Video + Features side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Video - smaller, 2/5 width */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Play className="w-4 h-4 text-green-600" />
                {t("Conheça a Start Campus")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src={embedUrl}
                  title="Start Campus"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </CardContent>
          </Card>

          {/* What you can do - 3/5 width */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="w-4 h-4 text-blue-600" />
                {isAllProjects
                  ? "O que pode fazer na visão global"
                  : `O que pode fazer em ${projectName}`
                }
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isAllProjects
                  ? "Visão consolidada de todos os projetos Start Campus."
                  : isNest
                  ? "Projeto em fase de operação — entregáveis ambientais anuais, resíduos e certificações."
                  : "Acompanhamento do cumprimento das medidas ambientais da DCAPE durante a construção."
                }
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map((feature, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group cursor-default">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
                      <feature.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className="font-semibold text-sm">{feature.title}</h3>
                        <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick tips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex gap-3 items-start p-4 rounded-xl bg-blue-50 border border-blue-100">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
            <div>
              <p className="text-sm font-medium text-blue-900 mb-0.5">Menu lateral</p>
              <p className="text-xs text-blue-700">Navegue entre as secções da plataforma usando o menu à esquerda.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start p-4 rounded-xl bg-green-50 border border-green-100">
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
            <div>
              <p className="text-sm font-medium text-green-900 mb-0.5">
                {userRole === "ee" || userRole === "rap" ? "Fichas semanais" : userRole === "raa" ? "Revisão" : "Dashboard"}
              </p>
              <p className="text-xs text-green-700">
                {userRole === "ee" || userRole === "rap"
                  ? "Submeta atempadamente para evitar alertas."
                  : userRole === "raa"
                  ? "Reveja e forneça feedback detalhado."
                  : "Consulte o estado de cumprimento."
                }
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start p-4 rounded-xl bg-amber-50 border border-amber-100">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</div>
            <div>
              <p className="text-sm font-medium text-amber-900 mb-0.5">Personalização</p>
              <p className="text-xs text-amber-700">Alterne entre modo claro/escuro e PT/EN no menu do utilizador.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start p-4 rounded-xl bg-purple-50 border border-purple-100">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">4</div>
            <div>
              <p className="text-sm font-medium text-purple-900 mb-0.5">Suporte</p>
              <p className="text-xs text-purple-700">Contacte apoioamb@startcampus.pt ou use "Deixar Feedback".</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
