import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { User, Save, Loader2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  user: "Utilizador",
  admin: "Admin",
  ee: "Entidade Executante",
  raa: "RAA",
  rap: "RAP",
  dono_obra: "Dono de Obra",
  observador: "Observador",
};

export default function Profile() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const profileQuery = trpc.profile.get.useQuery();
  const utils = trpc.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [qrData, setQrData] = useState<{ qrCode: string; secret: string } | null>(null);

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => { toast.success("Palavra-passe alterada com sucesso"); setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword(""); },
    onError: (err) => toast.error(err.message),
  });

  const setup2FAMutation = trpc.auth.setup2FA.useMutation({
    onSuccess: (data) => { setQrData({ qrCode: data.qrCode, secret: data.secret }); },
    onError: (err) => toast.error(err.message),
  });

  const confirm2FAMutation = trpc.auth.confirm2FA.useMutation({
    onSuccess: () => { toast.success("2FA ativado com sucesso!"); setQrData(null); setTotpCode(""); },
    onError: (err) => toast.error(err.message),
  });

  const disable2FAMutation = trpc.auth.disable2FA.useMutation({
    onSuccess: () => { toast.success("2FA desativado"); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso");
      profileQuery.refetch();
      // Invalidate auth.me so the sidebar name updates immediately
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error("Erro ao atualizar perfil: " + err.message);
    },
  });

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setFullName(profileQuery.data.fullName || "");
      setDisplayName(profileQuery.data.name || "");
      setJobTitle(profileQuery.data.jobTitle || "");
    }
  }, [profileQuery.data]);

  const handleSave = () => {
    updateMutation.mutate({
      fullName: fullName.trim() || undefined,
      displayName: displayName.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
    });
  };

  const hasChanges =
    fullName !== (profileQuery.data?.fullName || "") ||
    displayName !== (profileQuery.data?.name || "") ||
    jobTitle !== (profileQuery.data?.jobTitle || "");

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Perfil")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerir as suas informações pessoais
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {profileQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("Email")}</Label>
                  <Input
                    id="email"
                    value={profileQuery.data?.email || ""}
                    disabled
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">{t("Papel")}</Label>
                  <Input
                    id="role"
                    value={ROLE_LABELS[profileQuery.data?.role || "user"] || profileQuery.data?.role || ""}
                    disabled
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    O papel é definido pelo administrador.
                  </p>
                </div>

                <div className="border-t pt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">{t("Nome de Perfil")}</Label>
                    <Input
                      id="displayName"
                      placeholder="Nome de perfil"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome que aparece na sidebar e nas fichas. Pode ser o primeiro nome ou alcunha.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("Nome Completo")}</Label>
                    <Input
                      id="fullName"
                      placeholder="Nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome completo para documentos oficiais e relatórios.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">{t("Cargo")}</Label>
                    <Input
                      id="jobTitle"
                      placeholder="Cargo ou função"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cargo ou função na empresa.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || updateMutation.isPending}
                    className="min-w-[140px]"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        A guardar...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" />
              Alterar Palavra-passe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Palavra-passe actual")}</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Palavra-passe actual" />
            </div>
            <div className="space-y-2">
              <Label>{t("Nova palavra-passe")}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova palavra-passe (min. 6 caracteres)" />
            </div>
            <div className="space-y-2">
              <Label>{t("Confirmar nova palavra-passe")}</Label>
              <Input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Confirmar nova palavra-passe" />
            </div>
            <Button onClick={() => {
              if (newPassword.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
              if (newPassword !== confirmNewPassword) { toast.error("As palavras-passe não coincidem"); return; }
              changePasswordMutation.mutate({ currentPassword, newPassword });
            }} disabled={changePasswordMutation.isPending || !currentPassword || !newPassword}>
              {changePasswordMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
              Alterar Palavra-passe
            </Button>
          </CardContent>
        </Card>

        {/* 2FA Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Autenticação de Dois Fatores (2FA)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Adicione uma camada extra de segurança à sua conta usando o Google Authenticator ou Microsoft Authenticator.
            </p>
            {!qrData ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setup2FAMutation.mutate()} disabled={setup2FAMutation.isPending}>
                  <ShieldCheck className="h-4 w-4 mr-2" /> Configurar 2FA
                </Button>
                <Button variant="destructive" size="sm" onClick={() => disable2FAMutation.mutate()} disabled={disable2FAMutation.isPending}>
                  Desativar 2FA
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium">1. Digitalize o QR code com o seu Authenticator:</p>
                <div className="flex justify-center">
                  <img src={qrData.qrCode} alt="QR Code 2FA" className="w-48 h-48 border rounded" />
                </div>
                <p className="text-xs text-muted-foreground text-center">Chave manual: {qrData.secret}</p>
                <p className="text-sm font-medium">2. Introduza o código de 6 dígitos para confirmar:</p>
                <div className="flex gap-2">
                  <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="font-mono text-lg tracking-widest" maxLength={6} />
                  <Button onClick={() => confirm2FAMutation.mutate({ code: totpCode })} disabled={totpCode.length !== 6 || confirm2FAMutation.isPending}>
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
import { Lock, Shield, ShieldCheck } from "lucide-react";
