import AppLayout from "@/components/AppLayout";
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
  const { user } = useAuth();
  const profileQuery = trpc.profile.get.useQuery();
  const utils = trpc.useUtils();
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
          <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
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
                  <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="role">Papel</Label>
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
                    <Label htmlFor="displayName">Nome de Perfil</Label>
                    <Input
                      id="displayName"
                      placeholder="Ex: Ricardo"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome que aparece na sidebar e nas fichas. Pode ser o primeiro nome ou alcunha.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <Input
                      id="fullName"
                      placeholder="Ex: Ricardo Manuel Duarte"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome completo para documentos oficiais e relatórios.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Cargo</Label>
                    <Input
                      id="jobTitle"
                      placeholder="Ex: Engenheiro Ambiental"
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
      </div>
    </AppLayout>
  );
}
