import { useAuth } from "@/_core/hooks/useAuth";
import { LOGO_URL } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Loader2, Mail, Lock, Shield, UserPlus, Globe2, Moon, Sun } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

type ViewMode = "login" | "register" | "2fa" | "changePassword" | "forgotPassword";

export default function Login() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerCompany, setRegisterCompany] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [autoLoginLoading, setAutoLoginLoading] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const autoLoginRef = useRef(false);

  const { data: brandImages } = trpc.appSettings.getAll.useQuery();
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
        window.location.href = "/welcome";
      } else {
        sessionStorage.setItem("pw_verified", "1");
        window.location.href = "/welcome";
      }
    },
    onError: (err) => setError(err.message),
  });

  const verify2FAMutation = trpc.auth.verify2FA.useMutation({
    onSuccess: (data) => {
      if (data.mustChangePassword) {
        window.location.href = "/welcome";
      } else {
        sessionStorage.setItem("pw_verified", "1");
        window.location.href = "/welcome";
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

  const forgotMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: (data) => { setSuccess(data.message); },
    onError: (err) => setError(err.message),
  });

  // ACC auto-login (iframe detection)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("error") === "no_access") {
      const emailParam = params.get("email") || "";
      setError(`O email ${emailParam} não tem acesso. Contacte apoioamb@startcampus.pt`);
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
          if (res.ok) { window.location.href = "/welcome"; }
          else { setAutoLoginAttempted(true); setAutoLoginLoading(false); }
        })
        .catch(() => { setAutoLoginAttempted(true); setAutoLoginLoading(false); });
    } else {
      setAutoLoginAttempted(true);
    }
  }, [loading, user, autoLoginAttempted]);

  useEffect(() => {
    if (!loading && user && viewMode === "login") setLocation("/welcome");
    // OAuth users go directly to dashboard
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
    registerMutation.mutate({ email: email.trim(), password, name: registerName.trim(), companyName: registerCompany.trim() || undefined });
  };

  const handleAutodeskLogin = () => { window.location.href = "/api/autodesk/login"; };
  const isInIframe = window.self !== window.top;

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_8%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_29%),radial-gradient(circle_at_4%_96%,color-mix(in_oklch,var(--chart-2)_9%,transparent),transparent_34%)]" />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur" onClick={() => toggleTheme?.()}>
          {theme === "dark" ? <Sun className="mr-1.5 h-3.5 w-3.5" /> : <Moon className="mr-1.5 h-3.5 w-3.5" />}
          {theme === "dark" ? t("Modo claro") : t("Modo escuro")}
        </Button>
        <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur" onClick={() => setLanguage(language === "pt" ? "en" : "pt")}>
          <Globe2 className="mr-1.5 h-3.5 w-3.5" />{language === "pt" ? "English" : "Português"}
        </Button>
      </div>
      {/* Left panel - brand image (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative border-r border-border/50">
        <img src={brandImages?.image_login || "/manus-storage/sc-aerial-1_176e4635.jpg"} alt="Start Campus Sines" className="w-full h-full object-cover" style={{ objectPosition: brandImages?.image_login_position || "center" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent flex flex-col justify-end p-10">
          <p className="stand-kicker text-emerald-200">Start Campus · Sines</p>
          <h2 className="mt-3 text-white text-4xl font-semibold tracking-[-0.05em]">STAND</h2>
          <p className="mt-3 max-w-md text-white/85 text-lg leading-7">{t("Onde a sustentabilidade ganha posição")}</p>
          <p className="text-white/60 text-sm mt-3">{t("Infraestruturas digitais sustentáveis, com governação ambiental.")}</p>
        </div>
      </div>
      {/* Right panel - login form */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-[1.35rem] bg-card/95 shadow-[0_24px_60px_hsl(var(--shadow-color)/0.13)] border border-border/75 p-7 sm:p-8 backdrop-blur">
        <div className="flex flex-col items-center gap-5 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <img src={LOGO_URL} alt="Start Campus" className="h-9 object-contain brightness-0 invert" />
          </div>
          <div className="text-center">
            <p className="stand-kicker text-primary">Environmental governance</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">STAND</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {viewMode === "login" && "Introduza as suas credenciais para aceder"}
              {viewMode === "register" && "Crie uma conta para solicitar acesso"}
              {viewMode === "2fa" && "Introduza o código do Authenticator"}
              {viewMode === "changePassword" && "Introduza a sua palavra-passe para continuar"}
              {viewMode === "forgotPassword" && "Recuperação de palavra-passe"}
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
          <div className="flex items-start gap-2 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-sm mb-4">
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
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email profissional</label>
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="login-email" type="email" placeholder="nome@empresa.pt" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className="pl-10 h-12" autoFocus={!isInIframe} disabled={loginMutation.isPending} />
              </div>
              <div className="relative">
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Palavra-passe</label>
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="login-password" type="password" placeholder="Palavra-passe" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className="pl-10 h-12" disabled={loginMutation.isPending} />
              </div>
              <Button type="submit" size="lg" className="w-full h-12 shadow-lg" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A verificar...</>) : t("Entrar")}
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
              <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => { setViewMode("forgotPassword"); setError(""); setSuccess(""); }}>
                {t("Esqueceu a palavra-passe?")}
              </button>
            </div>
          </>
        )}

        {/* ─── 2FA Verification ─── */}
        {viewMode === "2fa" && (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div className="text-center mb-4">
              <Shield className="w-12 h-12 mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">{t("Abra o Google Authenticator ou Microsoft Authenticator e introduza o código de 6 dígitos.")}</p>
            </div>
            <Input type="text" placeholder="000000" value={totpCode} onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} className="h-14 text-center text-2xl tracking-widest font-mono" maxLength={6} autoFocus />
            <Button type="submit" size="lg" className="w-full h-12" disabled={verify2FAMutation.isPending}>
              {verify2FAMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A verificar...</>) : "Verificar"}
            </Button>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button type="button" className="text-sm text-muted-foreground hover:underline w-full text-center" onClick={() => { setViewMode("login"); setTotpCode(""); setError(""); setUserId(null); }}>
              ← Voltar ao login
            </button>
            <p className="text-xs text-muted-foreground text-center">{t("Não tem acesso ao autenticador? Contacte")}<strong>apoioamb@startcampus.pt</strong></p>
          </form>
        )}

        {/* ─── Register Form ─── */}
        {viewMode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Input type="text" placeholder={t("Nome completo")} value={registerName} onChange={(e) => { setRegisterName(e.target.value); setError(""); }} className="h-12" autoFocus />
            <Input type="text" placeholder={t("Nome da empresa")} value={registerCompany} onChange={(e) => { setRegisterCompany(e.target.value); }} className="h-12" />
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" placeholder="nome@empresa.pt" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className="pl-10 h-12" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" placeholder={t("Palavra-passe (mín. 8 caracteres)")} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className="pl-10 h-12" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" placeholder={t("Confirmar palavra-passe")} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} className="pl-10 h-12" />
            </div>
            <Button type="submit" size="lg" className="w-full h-12" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A criar...</>) : "Solicitar Acesso"}
            </Button>
            <button type="button" className="text-sm text-muted-foreground hover:underline w-full text-center" onClick={() => { setViewMode("login"); setError(""); setSuccess(""); }}>{t("Já tenho conta — Entrar")}</button>
            <p className="text-xs text-muted-foreground text-center mt-2">{t("Após criar conta, o administrador irá aprovar o seu acesso.")}</p>
          </form>
        )}

        {/* ─── Forgot Password Form ─── */}
        {viewMode === "changePassword" && (
          <form onSubmit={(e) => {
            e.preventDefault();
            setError("");
            if (!password.trim()) { setError("Introduza a palavra-passe"); return; }
            loginMutation.mutate({ email: user?.email || "", password });
          }} className="space-y-4">
            <div className="text-center mb-4">
              <Shield className="w-12 h-12 mx-auto text-green-600 mb-2" />
              <p className="text-sm text-muted-foreground">{t("Verificação de segurança — confirme a sua identidade.")}</p>
              {user?.email && <p className="text-xs text-muted-foreground mt-1 font-medium">{user.email}</p>}
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
              </div>
            )}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" placeholder="Palavra-passe" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className="pl-10 h-12" autoFocus />
            </div>
            <Button type="submit" size="lg" className="w-full h-12 shadow-lg shadow-primary/15" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A verificar...</>) : "Confirmar"}
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setViewMode("forgotPassword")}>
                Esqueceu a palavra-passe?
              </button>
              <button type="button" className="text-red-500 hover:underline" onClick={() => { void logout().finally(() => { window.location.href = "/login"; }); }}>{t("Terminar Sessão")}</button>
            </div>
          </form>
        )}
        {viewMode === "forgotPassword" && (
          <form onSubmit={(e) => {
            e.preventDefault();
            setError(""); setSuccess("");
            if (!email.trim()) { setError("Introduza o seu email"); return; }
            forgotMutation.mutate({ email: email.trim() });
          }} className="space-y-4">
            <div className="text-center mb-4">
              <Mail className="w-12 h-12 mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">{t("Introduza o email associado à sua conta. O administrador será notificado para proceder ao reset da palavra-passe.")}</p>
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" placeholder="nome@empresa.pt" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className="pl-10 h-12" autoFocus />
            </div>
            <Button type="submit" size="lg" className="w-full h-12" disabled={forgotMutation.isPending}>
              {forgotMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A enviar...</>) : "Solicitar Recuperação"}
            </Button>
            <button type="button" className="text-sm text-muted-foreground hover:underline w-full text-center" onClick={() => { setViewMode("login"); setError(""); setSuccess(""); }}>
              ← Voltar ao login
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Contacte <strong>apoioamb@startcampus.pt</strong>{t("para assistência imediata.")}</p>
          </form>
        )}
        </div>
      </div>
      </div>
    </div>
  );
}
