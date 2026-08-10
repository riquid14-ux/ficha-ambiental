import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImageIcon, Save, Eye } from "lucide-react";

const IMAGE_KEYS = [
  { key: "image_dashboard", label: "Dashboard", description: "Imagem de topo no Dashboard (todos os projetos)" },
  { key: "image_timeline", label: "Timeline", description: "Imagem de topo na página Timeline" },
  { key: "image_ficha_semanal", label: "Ficha Semanal", description: "Imagem de topo na Ficha Semanal" },
];

export default function ImagesTab() {
  const { data: settings, refetch } = trpc.appSettings.getAll.useQuery();
  const updateMutation = trpc.appSettings.update.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Imagem atualizada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setUrls(settings);
    }
  }, [settings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="w-4 h-4" /> Gestão de Imagens
        </CardTitle>
        <p className="text-xs text-muted-foreground">Cole o URL de uma imagem para cada secção. Pode usar imagens de https://www.startcampus.pt/brand</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {IMAGE_KEYS.map(({ key, label, description }) => (
          <div key={key} className="space-y-2 border-b pb-4 last:border-0">
            <Label className="font-medium">{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.startcampus.pt/hubfs/Images/..."
                value={urls[key] || ""}
                onChange={(e) => setUrls(prev => ({ ...prev, [key]: e.target.value }))}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewing(previewing === key ? null : key)}
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={() => updateMutation.mutate({ key, value: urls[key] || "" })}
                disabled={updateMutation.isPending || urls[key] === settings?.[key]}
              >
                <Save className="w-3.5 h-3.5 mr-1" /> Guardar
              </Button>
            </div>
            {previewing === key && urls[key] && (
              <div className="mt-2 rounded-lg overflow-hidden border h-32">
                <img
                  src={urls[key]}
                  alt={label}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = ""; toast.error("URL inválido ou imagem não encontrada"); }}
                />
              </div>
            )}
          </div>
        ))}

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Dica:</strong> Vá a <a href="https://www.startcampus.pt/brand" target="_blank" className="underline text-primary">startcampus.pt/brand</a>, clique com o botão direito numa imagem, copie o endereço da imagem e cole aqui.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
