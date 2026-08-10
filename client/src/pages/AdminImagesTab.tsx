import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImageIcon, Save, Eye, Plus, Trash2 } from "lucide-react";

const DEFAULT_IMAGE_KEYS = [
  { key: "image_dashboard", label: "Dashboard", description: "Imagem de topo no Dashboard (todos os projetos)" },
  { key: "image_timeline", label: "Timeline", description: "Imagem de topo na página Timeline" },
  { key: "image_ficha_semanal", label: "Ficha Semanal", description: "Imagem de topo na Ficha Semanal" },
];

const POSITION_OPTIONS = [
  { value: "top", label: "Topo" },
  { value: "center", label: "Centro" },
  { value: "bottom", label: "Baixo" },
  { value: "left", label: "Esquerda" },
  { value: "right", label: "Direita" },
];

export default function ImagesTab() {
  const { data: settings, refetch } = trpc.appSettings.getAll.useQuery();
  const updateMutation = trpc.appSettings.update.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Guardado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [customLocations, setCustomLocations] = useState<{ key: string; label: string }[]>([]);

  useEffect(() => {
    if (settings) {
      const newUrls: Record<string, string> = {};
      const newPositions: Record<string, string> = {};
      const extras: { key: string; label: string }[] = [];

      for (const [k, v] of Object.entries(settings)) {
        if (k.endsWith("_position")) {
          // Position setting
          const imageKey = k.replace("_position", "");
          newPositions[imageKey] = v;
        } else if (k.startsWith("image_custom_")) {
          // Custom location
          newUrls[k] = v;
          const label = k.replace("image_custom_", "").replace(/_/g, " ");
          extras.push({ key: k, label });
        } else {
          newUrls[k] = v;
        }
      }
      setUrls(newUrls);
      setPositions(newPositions);
      setCustomLocations(extras);
    }
  }, [settings]);

  const allLocations = [
    ...DEFAULT_IMAGE_KEYS,
    ...customLocations.map(c => ({ key: c.key, label: c.label, description: "Localização personalizada" })),
  ];

  function handleAddLocation() {
    if (!newLocationName.trim()) return;
    const key = "image_custom_" + newLocationName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (allLocations.some(l => l.key === key)) {
      toast.error("Já existe uma localização com esse nome");
      return;
    }
    setCustomLocations(prev => [...prev, { key, label: newLocationName.trim() }]);
    setNewLocationName("");
    toast.success(`Localização "${newLocationName.trim()}" adicionada. Cole o URL e guarde.`);
  }

  function handleDeleteLocation(key: string) {
    // Remove from custom locations and clear the setting
    setCustomLocations(prev => prev.filter(c => c.key !== key));
    updateMutation.mutate({ key, value: "" });
    updateMutation.mutate({ key: key + "_position", value: "" });
  }

  function handleSaveImage(key: string) {
    updateMutation.mutate({ key, value: urls[key] || "" });
    if (positions[key]) {
      updateMutation.mutate({ key: key + "_position", value: positions[key] });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="w-4 h-4" /> Gestão de Imagens
        </CardTitle>
        <p className="text-xs text-muted-foreground">Cole o URL de uma imagem e ajuste a posição. Use imagens de <a href="https://www.startcampus.pt/brand" target="_blank" className="underline text-primary">startcampus.pt/brand</a></p>
      </CardHeader>
      <CardContent className="space-y-6">
        {allLocations.map(({ key, label, description }) => {
          const isCustom = key.startsWith("image_custom_");
          return (
            <div key={key} className="space-y-2 border-b pb-4 last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                {isCustom && (
                  <Button size="sm" variant="ghost" className="text-red-500 h-7" onClick={() => handleDeleteLocation(key)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.startcampus.pt/hubfs/Images/..."
                  value={urls[key] || ""}
                  onChange={(e) => setUrls(prev => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1"
                />
                <Select value={positions[key] || "center"} onValueChange={(v) => setPositions(prev => ({ ...prev, [key]: v }))}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setPreviewing(previewing === key ? null : key)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" onClick={() => handleSaveImage(key)} disabled={updateMutation.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" /> Guardar
                </Button>
              </div>
              {previewing === key && urls[key] && (
                <div className="mt-2 rounded-lg overflow-hidden border h-32">
                  <img
                    src={urls[key]}
                    alt={label}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: positions[key] || "center" }}
                    onError={(e) => { (e.target as HTMLImageElement).src = ""; toast.error("URL inválido"); }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Add new location */}
        <div className="border-t pt-4">
          <Label className="font-medium text-sm">Adicionar nova localização de imagem</Label>
          <p className="text-xs text-muted-foreground mb-2">Crie um novo espaço para imagem (ex: "Login", "Perfil", "Relatório")</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova localização..."
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
              className="flex-1"
            />
            <Button size="sm" onClick={handleAddLocation} disabled={!newLocationName.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Dica:</strong> Vá a <a href="https://www.startcampus.pt/brand" target="_blank" className="underline text-primary">startcampus.pt/brand</a>, clique com o botão direito numa imagem, copie o endereço e cole aqui. Use a posição para ajustar o enquadramento (Topo = mostra a parte de cima da foto, Baixo = mostra a parte de baixo).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
