import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LOGO_URL } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Leaf,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const capabilityItems = [
  {
    title: "Conformidade com contexto",
    description: "Fichas, medidas, planos e relatórios organizados por projeto, entidade e responsabilidade.",
  },
  {
    title: "Evidência que sustenta decisões",
    description: "Fotografias, anexos, auditoria e dados de desempenho reunidos sem dispersão por email.",
  },
  {
    title: "Operação com transparência",
    description: "Indicadores, consumo, água, custos e cenários num cockpit separado para o NEST.",
  },
];

export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) setLocation("/welcome");
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="stand-loading h-10 w-44 rounded-xl" />
          <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            <div className="stand-loading h-[28rem] rounded-[1.75rem]" />
            <div className="stand-loading h-[28rem] rounded-[1.75rem]" />
          </div>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,color-mix(in_oklch,var(--primary)_20%,transparent),transparent_26%),radial-gradient(circle_at_88%_16%,color-mix(in_oklch,var(--chart-2)_15%,transparent),transparent_29%),linear-gradient(135deg,color-mix(in_oklch,var(--surface-dashboard)_78%,transparent),transparent_62%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={LOGO_URL} alt="Start Campus" className="h-8 max-w-36 object-contain sm:h-9" />
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="stand-kicker hidden text-primary sm:inline">STAND · Environmental governance</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-border/70 bg-card/70 shadow-sm backdrop-blur" onClick={() => toggleTheme?.()}>
              {theme === "dark" ? <Sun className="mr-1.5 h-3.5 w-3.5" /> : <Moon className="mr-1.5 h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{theme === "dark" ? t("Modo claro") : t("Modo escuro")}</span>
            </Button>
            <Button variant="outline" size="sm" className="border-border/70 bg-card/70 shadow-sm backdrop-blur" onClick={() => setLanguage(language === "pt" ? "en" : "pt")}>
              <Globe2 className="mr-1.5 h-3.5 w-3.5" />{language === "pt" ? "English" : "Português"}
            </Button>
          </div>
        </header>

        <main className="stand-page-enter my-auto grid flex-1 items-center gap-6 py-10 lg:grid-cols-[1.08fr_.92fr] lg:py-12">
          <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/15 bg-card/80 p-7 shadow-[0_28px_65px_hsl(var(--shadow-color)/0.10)] backdrop-blur sm:p-10">
            <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative max-w-2xl">
              <div className="mb-6 flex items-center gap-2 text-primary">
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10"><Leaf className="size-4" /></span>
                <span className="stand-kicker">STAND · START CAMPUS</span>
              </div>
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.065em] sm:text-5xl lg:text-6xl">
                {t("Onde a sustentabilidade ganha posição")}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                {t("Governação ambiental, evidência auditável e decisão operacional reunidas num único espaço de trabalho para cada projeto.")}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button onClick={() => setLocation("/login")} size="lg" className="h-12 rounded-xl px-6 shadow-lg shadow-primary/20">
                  {t("Iniciar sessão")}<ChevronRight className="ml-2 size-4" />
                </Button>
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary" />{t("Acesso autenticado e auditável")}</span>
              </div>
              <div className="mt-10 grid gap-3 border-t border-border/70 pt-6 sm:grid-cols-3">
                {[
                  ["Por projeto", "Âmbito e permissões"],
                  ["Com evidência", "Rastreabilidade contínua"],
                  ["Para decisão", "Dados e reporting"],
                ].map(([value, label]) => (
                  <div key={value}>
                    <p className="text-sm font-semibold tracking-[-0.02em]">{t(value)}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(label)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="stand-surface relative overflow-hidden p-5 sm:p-7">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[3rem] bg-primary/[0.06]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="stand-kicker text-primary">{t("Como a plataforma trabalha")}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{t("Uma base única para cumprir, decidir e demonstrar")}</h2>
                </div>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><ArrowRight className="size-4" /></span>
              </div>
              <div className="mt-7 space-y-3">
                {capabilityItems.map((item, index) => (
                  <div key={item.title} className="stand-interactive flex gap-4 rounded-2xl border border-border/80 bg-surface-dashboard/50 p-4">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">0{index + 1}</span>
                    <div>
                      <p className="text-sm font-semibold">{t(item.title)}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(item.description)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.045] p-4">
                <LockKeyhole className="size-5 text-primary" />
                <p className="text-sm leading-6 text-muted-foreground">{t("A plataforma aplica permissões por papel, empresa e projeto; cada alteração crítica deixa evidência auditável.")}</p>
              </div>
            </div>
          </aside>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 py-5 text-xs text-muted-foreground">
          <span>Start Campus · Sines, Portugal</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-primary" />{t("Governance workspace")}</span>
        </footer>
      </div>
    </div>
  );
}
