import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { LOGO_URL } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-pulse text-emerald-300 text-lg">{t("A carregar...")}</div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Subtle background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-emerald-950/30 to-gray-900" />
      <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-lg">
        <img src={LOGO_URL} alt="Start Campus" className="h-16 object-contain mx-auto mb-10" />

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
          Plataforma de Gestão Ambiental
        </h1>

        <p className="text-gray-400 text-base mb-12">
          Delivering Sustainable AI-Scale Data Centers
        </p>

        <Button
          onClick={() => setLocation("/login")}
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-6 text-lg rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30"
        >
          {t("Iniciar sessão")}
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      {/* Minimal footer */}
      <div className="absolute bottom-6 text-center">
        <p className="text-xs text-gray-700">Start Campus, Sines, Portugal</p>
      </div>
    </div>
  );
}
