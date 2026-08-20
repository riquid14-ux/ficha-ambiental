import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "../contexts/ProjectContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  ClipboardList, BarChart3, CalendarDays, Recycle, FileBarChart,
  Shield, BookOpen, GitBranch, Layers, Heart, Play, Info, CheckCircle2
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

  // Construction projects (SIN02-SIN07, Subestação)
  const features: FeatureCard[] = [];

  if (["admin", "dono_obra", "pm"].includes(role)) {
    features.push({ icon: Shield, title: "Dashboard", description: "Visão geral do cumprimento ambiental — fichas aprovadas, em revisão, rascunhos e alertas de incumprimento." });
  }

  if (["admin", "dono_obra", "pm", "ee", "raa", "rap"].includes(role)) {
    features.push({ icon: BookOpen, title: "Workflow", description: "Consulte o fluxo de submissão e aprovação das fichas de controlo ambiental." });
  }

  if (["admin", "dono_obra", "pm", "ee", "raa", "rap"].includes(role)) {
    features.push({
      icon: ClipboardList,
      title: "Ficha Semanal",
      description: role === "ee"
        ? "Crie e submeta fichas de controlo semanais com as medidas ambientais atribuídas à sua empresa. Pode guardar rascunhos e consultar o histórico."
        : role === "rap"
        ? "Submeta fichas de controlo semanais relativas às medidas ambientais da sua responsabilidade."
        : role === "raa"
        ? "Reveja as fichas submetidas pelas entidades executantes. Aprove ou rejeite com comentários por medida."
        : "Crie, submeta e acompanhe fichas de controlo semanais. Consulte a matriz de acompanhamento e o histórico completo."
    });
  }

  if (["admin", "dono_obra", "pm", "ee", "raa"].includes(role)) {
    features.push({ icon: Recycle, title: "Gestão de Resíduos", description: "Registe resíduos por código LER, crie sub-projetos, gere Wastemap e exporte MIRR." });
  }

  if (["admin", "dono_obra", "pm", "ee", "rap"].includes(role)) {
    features.push({ icon: BarChart3, title: "KPI's", description: "Submeta dados semanais de sustentabilidade — trabalhadores, consumos de energia, água e incidentes. Consulte o dashboard de indicadores." });
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

  // Get video URL from app settings (admin configurable)
  const settingsQuery = trpc.appSettings.getAll.useQuery();
  const videoUrl = (settingsQuery.data as any)?.welcomeVideoUrl || "https://www.youtube.com/embed/IsjSfMUIWzE";
  // Convert YouTube watch URL to embed URL
  const embedUrl = videoUrl.includes("watch?v=")
    ? videoUrl.replace("watch?v=", "embed/")
    : videoUrl.includes("youtu.be/")
    ? videoUrl.replace("youtu.be/", "www.youtube.com/embed/")
    : videoUrl;

  const features = getFeatures(userRole, projectCode, isAllProjects, isNest);
  const roleLabel = ROLE_LABELS[userRole] || userRole;
  const projectName = isAllProjects ? "Todos os Projetos" : (activeProject?.name || projectCode);
  const userName = (user as any)?.name || (user as any)?.email?.split("@")[0] || "";

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Section */}
      <div className="rounded-xl overflow-hidden border bg-gradient-to-r from-green-700 to-emerald-600 text-white p-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold mb-2">
            {t("Bem-vindo")}, {userName}! 👋
          </h1>
          <p className="text-lg opacity-90 mb-3">
            {t("Plataforma de Gestão Ambiental")} — Start Campus
          </p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {roleLabel}
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {projectName}
            </Badge>
          </div>
        </div>
      </div>

      {/* Video Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Play className="w-5 h-5 text-green-600" />
            {t("Conheça a Start Campus")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              src={embedUrl}
              title="Start Campus"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </CardContent>
      </Card>

      {/* What you can do */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="w-5 h-5 text-blue-600" />
            {isAllProjects
              ? t("O que pode fazer na visão global")
              : isNest
              ? `O que pode fazer em ${projectName}`
              : `O que pode fazer em ${projectName}`
            }
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isAllProjects
              ? "Nesta vista tem acesso a uma visão consolidada de todos os projetos Start Campus."
              : isNest
              ? "Este projeto está em fase de operação. Aqui gere os entregáveis ambientais anuais, resíduos e certificações."
              : `Neste projeto acompanha o cumprimento das medidas ambientais da DCAPE durante a fase de construção.`
            }
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <div key={i} className="flex gap-3 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
                  <feature.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick tips */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            {t("Dicas rápidas")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex gap-2 items-start p-3 rounded-lg bg-blue-50 border border-blue-100">
              <span className="text-blue-600 font-bold text-sm">1.</span>
              <p className="text-sm text-blue-900">Utilize o menu lateral para navegar entre as diferentes secções da plataforma.</p>
            </div>
            <div className="flex gap-2 items-start p-3 rounded-lg bg-green-50 border border-green-100">
              <span className="text-green-600 font-bold text-sm">2.</span>
              <p className="text-sm text-green-900">
                {userRole === "ee" || userRole === "rap"
                  ? "Submeta as suas fichas semanais atempadamente para evitar alertas de incumprimento."
                  : userRole === "raa"
                  ? "Reveja as fichas submetidas e forneça feedback detalhado por medida."
                  : "Consulte o Dashboard para uma visão rápida do estado de cumprimento."
                }
              </p>
            </div>
            <div className="flex gap-2 items-start p-3 rounded-lg bg-amber-50 border border-amber-100">
              <span className="text-amber-600 font-bold text-sm">3.</span>
              <p className="text-sm text-amber-900">Pode alternar entre modo claro e escuro no menu do utilizador (canto inferior esquerdo).</p>
            </div>
            <div className="flex gap-2 items-start p-3 rounded-lg bg-purple-50 border border-purple-100">
              <span className="text-purple-600 font-bold text-sm">4.</span>
              <p className="text-sm text-purple-900">Em caso de dúvida, contacte apoioamb@startcampus.pt ou utilize o botão "Deixar Feedback".</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
