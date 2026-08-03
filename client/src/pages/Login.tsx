import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Loader2, Mail, Shield } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";

export default function Login() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [autoLoginLoading, setAutoLoginLoading] = useState(false);
  const autoLoginRef = useRef(false);

  const emailLoginMutation = trpc.auth.emailLogin.useMutation({
    onSuccess: () => {
      // Force reload to refresh auth state
      window.location.href = "/dashboard";
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Check URL params for error from Autodesk callback
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("error") === "no_access") {
      const emailParam = params.get("email") || "";
      setError(`O email ${emailParam} não tem acesso. Contacte Nairana Aguiar npa@startcampus.pt`);
      setAutoLoginAttempted(true);
    }
  }, [searchString]);

  // Auto-detect ACC context: try to auto-login using Autodesk token
  useEffect(() => {
    if (autoLoginRef.current || loading || user || autoLoginAttempted) return;
    autoLoginRef.current = true;

    // Check if we're in an iframe (likely ACC) or if ads_token cookie exists
    const isInIframe = window.self !== window.top;

    if (isInIframe) {
      // We're inside ACC iframe — attempt auto-login with Autodesk token
      setAutoLoginLoading(true);
      fetch("/api/autodesk/auto-login", {
        method: "POST",
        credentials: "include",
      })
        .then(async (res) => {
          if (res.ok) {
            // Auto-login succeeded — redirect to dashboard
            window.location.href = "/dashboard";
          } else {
            const data = await res.json().catch(() => ({}));
            if (res.status === 403) {
              setError(data.error || "Não tem acesso. Contacte Nairana Aguiar npa@startcampus.pt");
            }
            // If 401 (no token), user needs to authenticate with Autodesk first
            // Show the login page with option to authenticate via Autodesk
            setAutoLoginAttempted(true);
            setAutoLoginLoading(false);
          }
        })
        .catch(() => {
          setAutoLoginAttempted(true);
          setAutoLoginLoading(false);
        });
    } else {
      setAutoLoginAttempted(true);
    }
  }, [loading, user, autoLoginAttempted]);

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  if (loading || autoLoginLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {autoLoginLoading ? "A autenticar via Autodesk..." : "A carregar..."}
        </p>
      </div>
    );
  }

  if (user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Introduza o seu email");
      return;
    }
    emailLoginMutation.mutate({ email: email.trim() });
  };

  const handleAutodeskLogin = () => {
    // Redirect to Autodesk OAuth flow — after callback, user will be auto-logged in
    window.location.href = "/api/autodesk/login";
  };

  const isInIframe = window.self !== window.top;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-6 mb-8">
          <img
            src="/manus-storage/start_campus_logo_3e7c0dee.png"
            alt="Start Campus"
            className="h-16 object-contain"
          />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Ficha de Controlo Ambiental
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {isInIframe
                ? "Autentique-se para aceder à plataforma"
                : "Introduza o seu email para aceder à plataforma"}
            </p>
          </div>
        </div>

        {/* Autodesk Login Button (shown when in iframe or as alternative) */}
        {isInIframe && (
          <div className="mb-6">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full h-12 border-2 hover:bg-accent/50 transition-all"
              onClick={handleAutodeskLogin}
            >
              <Shield className="w-5 h-5 mr-2" />
              Entrar com Autodesk
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>
          </div>
        )}

        {/* Email Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="nome@empresa.pt"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className="pl-10 h-12"
              autoFocus={!isInIframe}
              disabled={emailLoginMutation.isPending}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full h-12 shadow-lg hover:shadow-xl transition-all"
            disabled={emailLoginMutation.isPending}
          >
            {emailLoginMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                A verificar...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        {/* Autodesk Login option for non-iframe users */}
        {!isInIframe && (
          <div className="mt-4">
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full h-12 border hover:bg-accent/50 transition-all"
              onClick={handleAutodeskLogin}
            >
              <Shield className="w-5 h-5 mr-2" />
              Entrar com Autodesk
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6">
          Apenas utilizadores convidados podem aceder à plataforma.
        </p>
      </div>
    </div>
  );
}
