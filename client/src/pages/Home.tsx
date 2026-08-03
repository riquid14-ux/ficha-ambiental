import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ClipboardList, BarChart3, Shield, Upload } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">A carregar...</div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
            <ClipboardList className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Ficha de Controlo Ambiental
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Plataforma de acompanhamento semanal de medidas de gestão ambiental em obras.
            Registe o cumprimento das 156 medidas, anexe evidências fotográficas e acompanhe a evolução.
          </p>
          <Button onClick={() => startLogin()} size="lg" className="mt-8 px-8">
            Iniciar sessão
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: ClipboardList, title: "156 Medidas", desc: "Todas as medidas DCAPE organizadas por secção" },
            { icon: Upload, title: "Evidências", desc: "Upload de fotos e observações por medida" },
            { icon: BarChart3, title: "Dashboard", desc: "Análise semanal com gráficos de cumprimento" },
            { icon: Shield, title: "Segurança", desc: "Controlo de acesso por empresa e papel" },
          ].map((f, i) => (
            <div key={i} className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
              <f.icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
