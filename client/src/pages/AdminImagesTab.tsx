import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { BRAND_IMAGE_DEFINITIONS, getBrandImageDefinition } from "@/lib/brand-images";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, ImageIcon, Link2, Plus, Save, Trash2, Upload } from "lucide-react";

const POSITION_OPTIONS = [
  { value: "top", label: "Topo (0%)" },
  { value: "center 20%", label: "20% do topo" },
  { value: "center 30%", label: "30% do topo" },
  { value: "center 40%", label: "40% do topo" },
  { value: "center", label: "Centro (50%)" },
  { value: "center 60%", label: "60% do topo" },
  { value: "center 70%", label: "70% do topo" },
  { value: "center 80%", label: "80% do topo" },
  { value: "bottom", label: "Baixo (100%)" },
];

const MODE_OPTIONS = [
  { value: "background", label: "Fundo do cabeçalho" },
  { value: "side", label: "Painel lateral" },
];

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

type ImageLocation = { key: string; pageKey: string; label: string; description: string; fallback?: string };

export default function ImagesTab() {
  const { t } = useLanguage();
  const { data: settings, refetch } = trpc.appSettings.getAll.useQuery();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationPage, setNewLocationPage] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [customLocations, setCustomLocations] = useState<ImageLocation[]>([]);

  const updateMutation = trpc.appSettings.update.useMutation({
    onSuccess: () => { refetch(); toast.success(t("Guardado com sucesso")); },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.appSettings.delete.useMutation({
    onSuccess: () => { refetch(); toast.success(t("Localização eliminada")); },
    onError: (error) => toast.error(error.message),
  });
  const uploadMutation = trpc.appSettings.uploadImage.useMutation({
    onSuccess: (result, variables) => {
      setUrls((current) => ({ ...current, [variables.key]: result.url }));
      refetch();
      toast.success(t("Imagem carregada e guardada"));
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!settings) return;
    const nextUrls: Record<string, string> = {};
    const nextPositions: Record<string, string> = {};
    const nextModes: Record<string, string> = {};
    const extras: ImageLocation[] = [];

    for (const [key, value] of Object.entries(settings)) {
      if (key.endsWith("_position")) nextPositions[key.replace("_position", "")] = value;
      else if (key.endsWith("_mode")) nextModes[key.replace("_mode", "")] = value;
      else if (key.startsWith("image_custom_") && !key.endsWith("_page")) {
        nextUrls[key] = value;
        const pageKey = settings[`${key}_page`] || "";
        extras.push({ key, pageKey, label: key.replace("image_custom_", "").replace(/_/g, " "), description: pageKey ? `Página: ${pageKey}` : "Página por definir" });
      } else if (key.startsWith("image_")) nextUrls[key] = value;
    }
    setUrls(nextUrls);
    setPositions(nextPositions);
    setModes(nextModes);
    setCustomLocations(extras);
  }, [settings]);

  const locations: ImageLocation[] = [
    ...BRAND_IMAGE_DEFINITIONS.map((image) => ({ ...image, fallback: image.fallback })),
    ...customLocations,
  ];

  function saveImage(key: string) {
    updateMutation.mutate({ key, value: urls[key] || "" });
    updateMutation.mutate({ key: `${key}_position`, value: positions[key] || getBrandImageDefinition(locations.find((item) => item.key === key)?.pageKey || "dashboard").position });
    updateMutation.mutate({ key: `${key}_mode`, value: modes[key] || "background" });
  }

  async function uploadImage(key: string, file?: File) {
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) return toast.error(t("Selecione uma imagem JPG, PNG ou WebP."));
    if (file.size > 5 * 1024 * 1024) return toast.error(t("A imagem não pode ultrapassar 5 MB."));
    try {
      uploadMutation.mutate({ key, filename: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", data: await readFile(file) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Não foi possível ler a imagem."));
    }
  }

  function addLocation() {
    if (!newLocationName.trim() || !newLocationPage) return toast.error(t("Preencha o nome e selecione a página"));
    const key = `image_custom_${newLocationName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
    if (locations.some((location) => location.key === key)) return toast.error(t("Já existe uma localização com esse nome"));
    updateMutation.mutate({ key: `${key}_page`, value: newLocationPage });
    setCustomLocations((current) => [...current, { key, pageKey: newLocationPage, label: newLocationName.trim(), description: `Página: ${newLocationPage}` }]);
    setNewLocationName("");
    setNewLocationPage("");
    setShowNewForm(false);
  }

  function deleteLocation(key: string) {
    setCustomLocations((current) => current.filter((location) => location.key !== key));
    deleteMutation.mutate({ key });
  }

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/35">
        <CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="size-4 text-primary" />{t("Imagens institucionais")}</CardTitle>
        <p className="max-w-3xl text-xs leading-5 text-muted-foreground">{t("Atribua uma fotografia a cada superfície. As imagens oficiais são a referência inicial e podem ser substituídas por upload seguro ou URL HTTPS.")}</p>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 xl:grid-cols-2">
          {locations.map((location) => {
            const definition = getBrandImageDefinition(location.pageKey || "dashboard");
            const previewUrl = urls[location.key] || location.fallback || definition.fallback;
            const isCustom = location.key.startsWith("image_custom_");
            return (
              <section key={location.key} className="rounded-2xl border border-border/80 bg-card p-4 shadow-[0_8px_22px_hsl(var(--shadow-color)/0.035)]">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-semibold text-foreground">{location.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{location.description}</p></div>
                  {isCustom && <Button size="icon" variant="ghost" className="shrink-0 text-destructive hover:text-destructive" onClick={() => deleteLocation(location.key)} aria-label={t("Eliminar localização")}><Trash2 className="size-4" /></Button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_142px]">
                  <div><Label className="text-xs">{t("Imagem")}</Label><Input className="mt-1" value={urls[location.key] || ""} placeholder={definition.fallback} onChange={(event) => setUrls((current) => ({ ...current, [location.key]: event.target.value }))} /></div>
                  <div><Label className="text-xs">{t("Focal")}</Label><Select value={positions[location.key] || definition.position} onValueChange={(value) => setPositions((current) => ({ ...current, [location.key]: value }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{POSITION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_142px]">
                  <div><Label className="text-xs">{t("Carregar ficheiro")}</Label><Input className="mt-1 cursor-pointer" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadImage(location.key, event.target.files?.[0]); event.currentTarget.value = ""; }} disabled={uploadMutation.isPending} /></div>
                  <div><Label className="text-xs">{t("Modo")}</Label><Select value={modes[location.key] || definition.mode || "background"} onValueChange={(value) => setModes((current) => ({ ...current, [location.key]: value }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{MODE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setPreviewing(previewing === location.key ? null : location.key)}><Eye className="mr-1.5 size-3.5" />{t("Pré-visualizar")}</Button><Button size="sm" variant="outline" onClick={() => setUrls((current) => ({ ...current, [location.key]: definition.fallback }))}><Link2 className="mr-1.5 size-3.5" />{t("Repor oficial")}</Button><Button size="sm" onClick={() => saveImage(location.key)} disabled={updateMutation.isPending}><Save className="mr-1.5 size-3.5" />{t("Guardar")}</Button></div>
                {previewing === location.key && <div className="relative mt-3 h-36 overflow-hidden rounded-xl border border-border"><img src={previewUrl} alt={location.label} className="h-full w-full object-cover" style={{ objectPosition: positions[location.key] || definition.position }} onError={(event) => { event.currentTarget.style.display = "none"; toast.error(t("URL inválido")); }} /><div className="absolute inset-0 bg-gradient-to-r from-[#062b2d]/70 to-transparent" /><span className="absolute bottom-3 left-3 text-xs font-medium text-white">{location.label}</span></div>}
              </section>
            );
          })}
        </div>
        <section className="rounded-2xl border border-dashed border-border bg-muted/25 p-4">
          {!showNewForm ? <Button variant="outline" size="sm" onClick={() => setShowNewForm(true)}><Plus className="mr-1.5 size-4" />{t("Adicionar localização personalizada")}</Button> : <div className="grid gap-3 sm:grid-cols-[1fr_230px_auto]"><Input value={newLocationName} onChange={(event) => setNewLocationName(event.target.value)} placeholder={t("Ex.: Área de parceiros")} /><Select value={newLocationPage} onValueChange={setNewLocationPage}><SelectTrigger><SelectValue placeholder={t("Selecione a página")} /></SelectTrigger><SelectContent>{BRAND_IMAGE_DEFINITIONS.map((image) => <SelectItem key={image.pageKey} value={image.pageKey}>{image.label}</SelectItem>)}</SelectContent></Select><div className="flex gap-2"><Button size="sm" onClick={addLocation}><Upload className="mr-1.5 size-3.5" />{t("Criar")}</Button><Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>{t("Cancelar")}</Button></div></div>}
        </section>
      </CardContent>
    </Card>
  );
}
