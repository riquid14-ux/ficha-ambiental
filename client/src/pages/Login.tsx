import { useAuth } from "@/_core/hooks/useAuth";
import { LOGO_URL } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Loader2, Mail, Lock, Shield, UserPlus } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";

type ViewMode = "login" | "register" | "2fa" | "changePassword";

export default function Login() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [autoLoginLoading, setAutoLoginLoading] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const autoLoginRef = useRef(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.requires2FA) {
        setUserId(data.userId);
        setViewMode("2fa");
        setError("");
      } else if (data.mustChangePassword) {
        setMustChangePassword(true);
        setViewMode("changePassword");
        setError("");
        // Session was created, but force password change
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/dashboard";
      }
    },
    onError: (err) => setError(err.message),
  });

  const verify2FAMutation = trpc.auth.verify2FA.useMutation({
    onSuccess: (data) => {
      if (data.mustChangePassword) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/dashboard";
      }
    },
    onError: (err) => setError(err.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setSuccess(data.message);
      setViewMode("login");
      setEmail("");
      setPassword("");
      setRegisterName("");
    },
    onError: (err) => setError(err.message),
  });

  // ACC auto-login (iframe detection)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("error") === "no_access") {
      const emailParam = params.get("email") || "";
      setError(`O email ${emailParam} não tem acesso. Contacte Nairana Aguiar npa@startcampus.pt`);
      setAutoLoginAttempted(true);
    }
  }, [searchString]);

  useEffect(() => {
    if (autoLoginRef.current || loading || user || autoLoginAttempted) return;
    autoLoginRef.current = true;
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      setAutoLoginLoading(true);
      fetch("/api/autodesk/auto-login", { method: "POST", credentials: "include" })
        .then(async (res) => {
          if (res.ok) { window.location.href = "/dashboard"; }
          else { setAutoLoginAttempted(true); setAutoLoginLoading(false); }
        })
        .catch(() => { setAutoLoginAttempted(true); setAutoLoginLoading(false); });
    } else {
      setAutoLoginAttempted(true);
    }
  }, [loading, user, autoLoginAttempted]);

  useEffect(() => {
    if (!loading && user && viewMode === "login") setLocation("/dashboard");
  }, [loading, user, setLocation, viewMode]);

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

  if (user && viewMode === "login") return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!email.trim()) { setError("Introduza o seu email"); return; }
    if (!password) { setError("Introduza a palavra-passe"); return; }
    loginMutation.mutate({ email: email.trim(), password });
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!totpCode || totpCode.length !== 6) { setError("Introduza o código de 6 dígitos"); return; }
    if (userId) verify2FAMutation.mutate({ userId, code: totpCode });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!registerName.trim()) { setError("Introduza o seu nome"); return; }
    if (!email.trim()) { setError("Introduza o seu email"); return; }
    if (password.length < 6) { setError("A palavra-passe deve ter pelo menos 6 caracteres"); return; }
    if (password !== confirmPassword) { setError("As palavras-passe não coincidem"); return; }
    registerMutation.mutate({ email: email.trim(), password, name: registerName.trim() });
  };

  const handleAutodeskLogin = () => { window.location.href = "/api/autodesk/login"; };
  const isInIframe = window.self !== window.top;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-6 mb-8">
          <img src={LOGO_URL} alt="Start Campus" className="h-16 object-contain" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Plataforma Ambiental
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {viewMode === "login" && "Introduza as suas credenciais para aceder"}
              {viewMode === "register" && "Crie uma conta para solicitar acesso"}
              {viewMode === "2fa" && "Introduza o código do Authenticator"}
              {viewMode === "changePassword" && "Defina uma nova palavra-passe"}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm mb-4">
            <Shield className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ─── Login Form ─── */}
        {viewMode === "login" && (
          <>
            {isInIframe && (
              <div className="mb-6">
                <Button type="button" size="lg" variant="outline" className="w-full h-12 border-2" onClick={handleAutodeskLogin}>
                  <Shield className="w-5 h-5 mr-2" /> Entrar com Autodesk
                </Button>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou</span></div>
                </div>
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder="nome@empresa.pt" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className="pl-10 h-12" autoFocus={!isInIframe} disabled={loginMutation.isPending} />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" placeholder="Palavra-passe" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className="pl-10 h-12" disabled={loginMutation.isPending} />
              </div>
              <Button type="submit" size="lg" className="w-full h-12 shadow-lg" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A verificar...</>) : "Entrar"}
              </Button>
            </form>
            {!isInIframe && (
              <div className="mt-4">
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou</span></div>
                </div>
                <Button type="button" size="lg" variant="outline" className="w-full h-12" onClick={handleAutodeskLogin}>
                  <Shield className="w-5 h-5 mr-2" /> Entrar com Autodesk
                </Button>
              </div>
            )}
            <div className="flex justify-between mt-4">
              <button type="button" className="text-sm text-primary hover:underline" onClick={() => { setViewMode("register"); setError(""); setSuccess(""); }}>
                <UserPlus className="w-3 h-3 inline mr-1" /> Criar conta
              </button>
            </div>
          </>
        )}

        {/* ─── 2FA Verification ─── */}
        {viewMode === "2fa" && (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div className="text-center mb-4">
              <Shield className="w-12 h-12 mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Abra o Google Authenticator ou Microsoft Authenticator e introduza o código de 6 dígitos.</p>
            </div>
            <Input type="text" placeholder="000000" value={totpCode} onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} className="h-14 text-center text-2xl tracking-widest font-mono" maxLength={6} autoFocus />
            <Button type="submit" size="lg" className="w-full h-12" disabled={verify2FAMutation.isPending}>
              {verify2FAMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A verificar...</>) : "Verificar"}
            </Button>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button type="button" className="text-sm text-muted-foreground hover:underline w-full text-center" onClick={() => { setViewMode("login"); setTotpCode(""); setError(""); setUserId(null); }}>
              ← Voltar ao login
            </button>
            <p className="text-xs text-muted-foreground text-center">Não tem acesso ao autenticador? Contacte <strong>npa@startcampus.pt</strong></p>
          </form>
        )}

        {/* ─── Register Form ─── */}
        {viewMode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Input type="text" placeholder="Nome completo" value={registerName} onChange={(e) => { setRegisterName(e.target.value); setError(""); }} className="h-12" autoFocus />
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" placeholder="nome@empresa.pt" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className="pl-10 h-12" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" placeholder="Palavra-passe (min. 6 caracteres)" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className="pl-10 h-12" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" placeholder="Confirmar palavra-passe" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} className="pl-10 h-12" />
            </div>
            <Button type="submit" size="lg" className="w-full h-12" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A criar...</>) : "Solicitar Acesso"}
            </Button>
            <button type="button" className="text-sm text-muted-foreground hover:underline w-full text-center" onClick={() => { setViewMode("login"); setError(""); setSuccess(""); }}>
              Já tenho conta — Entrar
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Após criar conta, o administrador irá aprovar o seu acesso.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
