import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LOGO_URL } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ChevronRight, Globe2, Leaf, Moon, ShieldCheck, Sun } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/welcome");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-lg">{t("A carregar...")}</div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,color-mix(in_oklch,var(--primary)_13%,transparent),transparent_35%),radial-gradient(circle_at_90%_88%,color-mix(in_oklch,var(--chart-2)_10%,transparent),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-chart-2 to-primary" />

      <div className="absolute top-5 right-5 z-20 flex items-center gap-2">
        <Button variant="outline" size="sm" className="bg-card/75 backdrop-blur border-border/80" onClick={() => toggleTheme?.()}>
          {theme === "dark" ? <Sun className="mr-1.5 h-3.5 w-3.5" /> : <Moon className="mr-1.5 h-3.5 w-3.5" />}
          {theme === "dark" ? t("Modo claro") : t("Modo escuro")}
        </Button>
        <Button variant="outline" size="sm" className="bg-card/75 backdrop-blur border-border/80" onClick={() => setLanguage(language === "pt" ? "en" : "pt")}>
          <Globe2 className="mr-1.5 h-3.5 w-3.5" />{language === "pt" ? "English" : "Português"}
        </Button>
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-24 lg:py-16">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
          <section className="max-w-2xl">
            <div className="mb-8 flex items-center gap-3"><img src={LOGO_URL} alt="Start Campus" className="h-9 object-contain" /><span className="h-6 w-px bg-border" /><span className="stand-kicker text-primary">Environmental governance platform</span></div>
            <p className="stand-kicker text-primary">STAND · START CAMPUS</p>
            <h1 className="mt-4 max-w-xl text-5xl font-semibold tracking-[-0.06em] sm:text-6xl lg:text-7xl">{t("Onde a sustentabilidade ganha posição")}</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">Governação ambiental, evidência auditável e decisão operacional reunidas num único espaço de trabalho para cada projeto.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button onClick={() => setLocation("/login")} size="lg" className="h-12 rounded-xl px-6 shadow-lg shadow-primary/15">{t("Iniciar sessão")}<ChevronRight className="ml-2 h-4 w-4" /></Button>
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Acesso autenticado e auditável</span>
            </div>
          </section>
          <aside className="rounded-[1.5rem] border border-border/80 bg-card/70 p-5 shadow-[0_24px_60px_hsl(var(--shadow-color)/0.12)] backdrop-blur sm:p-6">
            <div className="flex items-center justify-between"><p className="stand-kicker text-muted-foreground">Visão de produto</p><ArrowUpRight className="h-4 w-4 text-primary" /></div>
            <div className="mt-8 space-y-6">
              <div className="border-l-2 border-primary pl-4"><p className="text-sm font-semibold">Conformidade por projeto</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Fichas, planos, medidas e reportings com responsáveis, histórico e decisão registada.</p></div>
              <div className="border-l-2 border-chart-2 pl-4"><p className="text-sm font-semibold">Decisão baseada em evidência</p><p className="mt-1 text-sm leading-6 text-muted-foreground">KPIs, resíduos, operação NEST e documentação organizados pelo contexto de cada equipa.</p></div>
              <div className="flex items-center gap-3 rounded-xl bg-surface-soft px-4 py-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Leaf className="h-4 w-4" /></span><div><p className="text-sm font-semibold">Start Campus · Sines</p><p className="text-xs text-muted-foreground">Infraestruturas digitais sustentáveis</p></div></div>
            </div>
          </aside>
        </div>
      </main>

      {/* Minimal footer */}
      <div className="relative z-10 flex items-center justify-between border-t border-border/70 px-6 py-5 text-xs text-muted-foreground">
        <p>Start Campus · Sines, Portugal</p>
        <p>STAND — Environmental Governance</p>
      </div>
    </div>
  );
}
