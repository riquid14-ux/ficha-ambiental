import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { LOGO_URL } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { ClipboardList, BarChart3, Shield, Upload, CalendarDays, Recycle, FileBarChart, GitBranch, ChevronRight, Leaf, Play, Users, Globe, Award } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/welcome");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-emerald-950 to-gray-900">
        <div className="animate-pulse text-emerald-300 text-lg">{t("A carregar...")}</div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Start Campus" className="h-10 object-contain" />
            <div>
              <p className="font-bold text-white text-sm leading-tight">Plataforma de Gestão Ambiental</p>
              <p className="text-emerald-400 text-xs">Start Campus</p>
            </div>
          </div>
          <Button onClick={() => setLocation("/login")} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6">
            {t("Iniciar sessão")}
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-emerald-950/50 to-gray-900" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <Leaf className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 text-sm font-medium">Delivering Sustainable AI-Scale Data Centers</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            <span className="text-white">Plataforma de</span><br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Gestão Ambiental</span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Monitorização e compliance ambiental para os projetos de construção sustentável da Start Campus em Sines, Portugal.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => setLocation("/login")} size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-6 text-lg rounded-xl shadow-lg shadow-emerald-500/20">
              {t("Iniciar sessão")}
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
            <Button onClick={() => setLocation("/login")} variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-10 py-6 text-lg rounded-xl">
              {t("Criar conta")}
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { value: "8", label: "Projetos Ativos" },
              { value: "156+", label: "Medidas DCAPE" },
              { value: "24/7", label: "Monitorização" },
              { value: "100%", label: "Compliance" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-bold text-emerald-400">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 relative">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">{t("Conheça a Start Campus")}</h2>
            <p className="text-gray-400 max-w-xl mx-auto">O maior campus de data centers sustentáveis da Europa, alimentado por energia 100% renovável.</p>
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-emerald-500/10">
            <div style={{ paddingBottom: "56.25%" }} className="relative">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/IsjSfMUIWzE?autoplay=0&mute=1&controls=1"
                title="Start Campus"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">{t("Funcionalidades")}</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Tudo o que precisa para gerir o compliance ambiental dos seus projetos de construção.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ClipboardList, title: "Fichas de Controlo", desc: "Submissão semanal de fichas com 156+ medidas DCAPE, evidências fotográficas e observações por medida.", color: "emerald" },
              { icon: BarChart3, title: "Dashboard Analítico", desc: "Visão geral do cumprimento ambiental com KPIs, gráficos de evolução e alertas de incumprimento.", color: "blue" },
              { icon: Shield, title: "Controlo de Acesso", desc: "Gestão de permissões por empresa e papel (EE, RAP, RAA, DO). Separação de deveres na aprovação.", color: "violet" },
              { icon: CalendarDays, title: "Calendário de Reporting", desc: "Prazos regulatórios, datas internas e estados de submissão integrados num calendário visual.", color: "amber" },
              { icon: Recycle, title: "Gestão de Resíduos", desc: "Registo de e-GARs, Wastemap por sub-projeto, geração automática de MIRR e exportação de dados.", color: "teal" },
              { icon: FileBarChart, title: "RDCD", desc: "Geração de relatórios de demonstração de cumprimento da DCAPE com seleção de medidas e evidências.", color: "rose" },
              { icon: GitBranch, title: "Timeline de Fases", desc: "Acompanhamento do progresso desde o pré-licenciamento até à operação, com evidências por fase.", color: "cyan" },
              { icon: Upload, title: "Importação de Fichas", desc: "Carregamento de fichas históricas em PDF com extração automática de dados por IA.", color: "orange" },
              { icon: Award, title: "Certificações", desc: "Gestão de certificações LEED O&M, EED e CELE com submissão de evidências e prazos integrados.", color: "pink" },
            ].map((f, i) => {
              const colorMap: Record<string, string> = {
                emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400",
                blue: "from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400",
                violet: "from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400",
                amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400",
                teal: "from-teal-500/20 to-teal-500/5 border-teal-500/20 text-teal-400",
                rose: "from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-400",
                cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400",
                orange: "from-orange-500/20 to-orange-500/5 border-orange-500/20 text-orange-400",
                pink: "from-pink-500/20 to-pink-500/5 border-pink-500/20 text-pink-400",
              };
              const cls = colorMap[f.color] || colorMap.emerald;
              return (
                <div key={i} className={`p-6 rounded-xl border bg-gradient-to-br ${cls} hover:scale-[1.02] transition-transform`}>
                  <f.icon className="w-8 h-8 mb-4" />
                  <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-20 bg-gray-900/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">{t("Papéis e Permissões")}</h2>
            <p className="text-gray-400">Cada utilizador vê apenas o que lhe é relevante.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: "EE", name: "Entidade Executante", desc: "Submete fichas semanais com medidas ambientais da sua empresa.", icon: Users },
              { role: "RAP", name: "Resp. Ambiental Projeto", desc: "Submete fichas de controlo relativas às medidas da sua responsabilidade.", icon: Shield },
              { role: "RAA", name: "Resp. Ambiental Atividade", desc: "Revê, aprova ou rejeita fichas submetidas com comentários por medida.", icon: Award },
              { role: "DO", name: "Dono de Obra", desc: "Visão completa de todos os projetos, dashboard e gestão de acessos.", icon: Globe },
            ].map((r, i) => (
              <div key={i} className="p-5 rounded-xl border border-white/10 bg-white/5 text-center">
                <r.icon className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <p className="text-xs text-emerald-400 font-bold mb-1">{r.role}</p>
                <p className="font-semibold text-white text-sm mb-2">{r.name}</p>
                <p className="text-xs text-gray-400">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Start Campus" className="h-8 object-contain" />
            <p className="text-sm text-gray-500">Plataforma de Gestão Ambiental</p>
          </div>
          <p className="text-xs text-gray-600">Start Campus, Sines, Portugal</p>
        </div>
      </footer>
    </div>
  );
}
