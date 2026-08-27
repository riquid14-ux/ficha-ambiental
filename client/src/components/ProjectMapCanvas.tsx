import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Camera, Check, Eye, EyeOff, Frame, Images, Layers3, LockKeyhole, Minus, Plus, RotateCcw, Satellite, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  assessProjectionConfidence,
  boundsFromPoints,
  boundsToPercent,
  finiteNumber,
  geoToPercent,
  metreSizeToPercent,
  parseGeoBounds,
  parsePhotoPose,
  photoGroundSize,
  viewportSizeMetres,
  type GeoBounds,
} from "@/lib/project-map-geometry";

type MapPhoto = {
  id: number;
  fileUrl: string;
  filename: string;
  latitude?: string | null;
  longitude?: string | null;
  relativeAltitudeM?: string | null;
  metadataJson?: string | null;
  capturedAt?: number | null;
};

type MapSetting = {
  baseMapUrl?: string | null;
  boundsJson?: string | null;
  sourceName?: string | null;
  attribution?: string | null;
  license?: string | null;
};

type Survey = {
  orthomosaicUrl?: string | null;
  orthomosaicBoundsJson?: string | null;
  resultType?: "photo_layers" | "orthomosaic";
};

export function ProjectMapCanvas({ photos, setting, survey, comparisonSurvey }: { photos: MapPhoto[]; setting?: MapSetting | null; survey?: Survey | null; comparisonSurvey?: Survey | null }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showLayers, setShowLayers] = useState(false);
  const [showBase, setShowBase] = useState(true);
  const [showBounds, setShowBounds] = useState(true);
  const [showOrthomosaic, setShowOrthomosaic] = useState(true);
  const [showFootprints, setShowFootprints] = useState(true);
  const [opacity, setOpacity] = useState(72);

  const mapped = useMemo(() => {
    const baseBounds = parseGeoBounds(setting?.boundsJson);
    const orthomosaicBounds = parseGeoBounds(survey?.orthomosaicBoundsJson);
    const comparisonBounds = parseGeoBounds(comparisonSurvey?.orthomosaicBoundsJson);
    const geolocated = photos.flatMap(photo => {
      const latitude = finiteNumber(photo.latitude);
      const longitude = finiteNumber(photo.longitude);
      if (latitude === undefined || longitude === undefined) return [];
      const pose = { ...parsePhotoPose(photo.metadataJson), relativeAltitudeM: finiteNumber(photo.relativeAltitudeM) ?? parsePhotoPose(photo.metadataJson).relativeAltitudeM };
      const confidence = assessProjectionConfidence(pose);
      return [{ photo, latitude, longitude, pose, confidence, size: photoGroundSize(pose) }];
    });
    const photoBounds = boundsFromPoints(geolocated.map(item => ({ latitude: item.latitude, longitude: item.longitude })), 200);
    const bounds: GeoBounds = photoBounds ?? orthomosaicBounds ?? baseBounds ?? { west: -8.88, south: 37.92, east: -8.86, north: 37.94 };
    return { baseBounds, orthomosaicBounds, comparisonBounds, geolocated, bounds, size: viewportSizeMetres(bounds) };
  }, [photos, setting, survey, comparisonSurvey]);

  const selected = mapped.geolocated.find(item => item.photo.id === selectedId) ?? mapped.geolocated[0];
  const baseFrame = mapped.baseBounds ? boundsToPercent(mapped.baseBounds, mapped.bounds) : null;
  const orthomosaicFrame = mapped.orthomosaicBounds ? boundsToPercent(mapped.orthomosaicBounds, mapped.bounds) : null;
  const comparisonFrame = mapped.comparisonBounds ? boundsToPercent(mapped.comparisonBounds, mapped.bounds) : null;
  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };
  const zoom = (factor: number) => setScale(current => Math.max(1, Math.min(8, current * factor)));
  const onWheel = (event: WheelEvent<HTMLDivElement>) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.16 : 0.86); };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || scale === 1) return;
    setOffset({ x: dragRef.current.originX + event.clientX - dragRef.current.x, y: dragRef.current.originY + event.clientY - dragRef.current.y });
  };
  const onPointerUp = () => { dragRef.current = null; };

  return (
    <div className="relative h-full min-h-[620px] overflow-hidden rounded-2xl border bg-[#dfe6df] shadow-sm">
      <div
        ref={viewportRef}
        role="application"
        aria-label={`Mapa privado com ${mapped.geolocated.length} fotografias georreferenciadas e buffer de 200 metros`}
        className="absolute inset-0 touch-none select-none overflow-hidden"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="absolute inset-0 bg-[#dfe6df]" style={{ backgroundImage: "linear-gradient(rgba(20,55,43,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(20,55,43,.10) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="absolute inset-0 will-change-transform" style={{ transform: `translate3d(${offset.x}px,${offset.y}px,0) scale(${scale})`, transition: dragRef.current ? "none" : "transform 160ms cubic-bezier(0.23,1,0.32,1)" }}>
          {showBase && setting?.baseMapUrl && baseFrame && (
            <img src={setting.baseMapUrl} alt="Mapa base privado do projecto" draggable={false} className="pointer-events-none absolute max-w-none object-fill" style={{ left: `${baseFrame.left}%`, top: `${baseFrame.top}%`, width: `${baseFrame.width}%`, height: `${baseFrame.height}%` }} />
          )}
          {showOrthomosaic && comparisonSurvey?.resultType === "orthomosaic" && comparisonSurvey.orthomosaicUrl && comparisonFrame && (
            <img src={comparisonSurvey.orthomosaicUrl} alt="Ortomosaico anterior para comparação" draggable={false} className="pointer-events-none absolute max-w-none object-fill" style={{ left: `${comparisonFrame.left}%`, top: `${comparisonFrame.top}%`, width: `${comparisonFrame.width}%`, height: `${comparisonFrame.height}%` }} />
          )}
          {showOrthomosaic && survey?.resultType === "orthomosaic" && survey.orthomosaicUrl && orthomosaicFrame && (
            <img src={survey.orthomosaicUrl} alt="Ortomosaico do levantamento" draggable={false} className="pointer-events-none absolute max-w-none object-fill" style={{ left: `${orthomosaicFrame.left}%`, top: `${orthomosaicFrame.top}%`, width: `${orthomosaicFrame.width}%`, height: `${orthomosaicFrame.height}%`, opacity: opacity / 100 }} />
          )}
          {showBounds && baseFrame && <div className="pointer-events-none absolute z-10 border-2 border-dashed border-lime-300/90 shadow-[0_0_0_1px_rgba(16,32,25,.45)]" style={{ left: `${baseFrame.left}%`, top: `${baseFrame.top}%`, width: `${baseFrame.width}%`, height: `${baseFrame.height}%` }} />}
          {showFootprints && mapped.geolocated.map((item, index) => {
            const position = geoToPercent({ latitude: item.latitude, longitude: item.longitude }, mapped.bounds);
            const footprint = metreSizeToPercent(item.size.widthM, item.size.heightM, item.latitude, mapped.bounds);
            const yaw = item.pose.gimbalYawDegree ?? 0;
            const active = selected?.photo.id === item.photo.id;
            if (!item.confidence.renderAsOverlay) return (
              <button key={item.photo.id} type="button" className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border-2 bg-white shadow-lg ${active ? "border-lime-300 ring-2 ring-[#17392d]/30" : "border-white"}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} onPointerDown={event => event.stopPropagation()} onClick={() => setSelectedId(item.photo.id)}>
                <img src={item.photo.fileUrl} alt="" className="size-12 object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-amber-600/95 py-0.5 text-[7px] font-semibold text-white">GPS</span>
              </button>
            );
            return (
              <button key={item.photo.id} type="button" className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden border-2 shadow-lg transition-[filter,opacity] ${active ? "border-lime-300 brightness-105" : "border-white/70"}`} style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${Math.max(2.8, footprint.width)}%`, height: `${Math.max(2.2, footprint.height)}%`, transform: `translate(-50%,-50%) rotate(${yaw}deg)`, opacity: opacity / 100 }} onPointerDown={event => event.stopPropagation()} onClick={() => setSelectedId(item.photo.id)} aria-label={`Fotografia ${index + 1}: ${item.photo.filename}`}>
                <img src={item.photo.fileUrl} alt="" className="size-full object-cover" />
              </button>
            );
          })}
        </div>

        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-xl bg-[#102019]/90 px-3 py-2 text-white shadow-xl backdrop-blur">
          <ShieldCheck className="size-4 text-lime-300" /><span className="text-xs font-semibold">Mapa privado</span><span className="text-[10px] text-white/55">buffer 200 m</span>
        </div>
        <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-xl border border-[#17392d]/15 bg-white/95 shadow-xl">
          <button className="grid size-10 place-items-center border-b" onPointerDown={event => event.stopPropagation()} onClick={() => zoom(1.25)} aria-label="Aproximar"><Plus className="size-4" /></button>
          <button className="grid size-10 place-items-center border-b" onPointerDown={event => event.stopPropagation()} onClick={() => zoom(0.8)} aria-label="Afastar"><Minus className="size-4" /></button>
          <button className="grid size-10 place-items-center" onPointerDown={event => event.stopPropagation()} onClick={reset} aria-label="Repor enquadramento"><RotateCcw className="size-4" /></button>
        </div>

        <Button type="button" variant="secondary" size="sm" className="absolute bottom-4 left-4 bg-[#102019]/90 text-white hover:bg-[#102019]" onPointerDown={event => event.stopPropagation()} onClick={() => setShowLayers(value => !value)}>
          <Layers3 className="mr-2 size-4" /> Camadas
        </Button>
        {showLayers && (
          <div className="absolute bottom-16 left-4 z-50 w-64 rounded-2xl border border-white/10 bg-[#102019]/95 p-4 text-white shadow-2xl backdrop-blur" onPointerDown={event => event.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Vista do mapa</p><button className="text-xs text-white/50" onClick={() => setShowLayers(false)}>Fechar</button></div>
            <button className="mt-3 flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/5" onClick={() => setShowBase(value => !value)}>{showBase ? <Eye className="size-4 text-lime-300" /> : <EyeOff className="size-4 text-white/30" />}<Satellite className="size-4" /><span className="text-xs">Mapa base privado</span></button>
            <button className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/5" onClick={() => setShowBounds(value => !value)}>{showBounds ? <Eye className="size-4 text-lime-300" /> : <EyeOff className="size-4 text-white/30" />}<Frame className="size-4" /><span className="text-xs">Limites do projecto</span></button>
            <button className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/5" onClick={() => setShowOrthomosaic(value => !value)}>{showOrthomosaic ? <Eye className="size-4 text-lime-300" /> : <EyeOff className="size-4 text-white/30" />}<Images className="size-4" /><span className="text-xs">Ortomosaico / comparação</span></button>
            <button className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/5" onClick={() => setShowFootprints(value => !value)}>{showFootprints ? <Eye className="size-4 text-lime-300" /> : <EyeOff className="size-4 text-white/30" />}<Camera className="size-4" /><span className="text-xs">Fotografias / footprints</span></button>
            <label className="mt-3 block text-[11px] text-white/65">Intensidade das camadas <span className="float-right">{opacity}%</span><input type="range" min="25" max="100" value={opacity} onChange={event => setOpacity(Number(event.target.value))} className="mt-2 w-full accent-lime-300" /></label>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-4 right-4 rounded-xl bg-white/94 px-3 py-2 text-[#17392d] shadow-lg backdrop-blur">
          <p className="text-xs font-semibold">{mapped.geolocated.length} fotos com GPS</p>
          <p className="text-[10px] text-[#17392d]/60">{mapped.size.width.toFixed(0)} × {mapped.size.height.toFixed(0)} m</p>
        </div>
        <div className="pointer-events-none absolute right-24 top-4 flex items-center gap-2 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold text-[#17392d] shadow"><span>N</span><span className="text-lg leading-none">↑</span></div>
      </div>

      {selected && (
        <div className="absolute right-4 top-20 z-40 w-72 overflow-hidden rounded-2xl border bg-white/96 shadow-2xl backdrop-blur">
          <img src={selected.photo.fileUrl} alt={selected.photo.filename} className="h-36 w-full object-cover" />
          <div className="p-4">
            <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold">{selected.photo.filename}</p><Check className="size-4 shrink-0 text-emerald-600" /></div>
            <p className="mt-1 text-xs text-muted-foreground">{selected.confidence.label}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><span>Lat. {selected.latitude.toFixed(6)}</span><span>Long. {selected.longitude.toFixed(6)}</span><span>Alt. {selected.pose.relativeAltitudeM?.toFixed(1) ?? "—"} m</span><span>Yaw {selected.pose.gimbalYawDegree?.toFixed(1) ?? "—"}°</span></div>
            <a href={selected.photo.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-xs font-medium text-emerald-700 underline underline-offset-2"><LockKeyhole className="mr-1.5 size-3" />Abrir fotografia privada</a>
          </div>
        </div>
      )}
    </div>
  );
}
