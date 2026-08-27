export type GeoPoint = { latitude: number; longitude: number };
export type GeoBounds = { west: number; south: number; east: number; north: number };
export type PhotoPose = {
  relativeAltitudeM?: number;
  imageWidth?: number;
  imageHeight?: number;
  gimbalYawDegree?: number;
  gimbalPitchDegree?: number;
  focalLength35mm?: number;
};

export type ProjectionConfidence = {
  level: "high" | "medium" | "low";
  renderAsOverlay: boolean;
  label: string;
};

const EARTH_RADIUS_M = 6_378_137;

export function finiteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseGeoBounds(value?: string | null): GeoBounds | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Partial<GeoBounds>;
    const west = finiteNumber(raw.west);
    const south = finiteNumber(raw.south);
    const east = finiteNumber(raw.east);
    const north = finiteNumber(raw.north);
    if (west === undefined || south === undefined || east === undefined || north === undefined) return null;
    if (west >= east || south >= north) return null;
    return { west, south, east, north };
  } catch {
    return null;
  }
}

export function parsePhotoPose(value?: string | null): PhotoPose {
  if (!value) return {};
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    return {
      relativeAltitudeM: finiteNumber(raw.relativeAltitudeM),
      imageWidth: finiteNumber(raw.imageWidth),
      imageHeight: finiteNumber(raw.imageHeight),
      gimbalYawDegree: finiteNumber(raw.gimbalYawDegree),
      gimbalPitchDegree: finiteNumber(raw.gimbalPitchDegree),
      focalLength35mm: finiteNumber(raw.focalLength35mm),
    };
  } catch {
    return {};
  }
}

export function assessProjectionConfidence(pose: PhotoPose): ProjectionConfidence {
  const complete = pose.relativeAltitudeM && pose.imageWidth && pose.imageHeight && pose.gimbalYawDegree !== undefined && pose.gimbalPitchDegree !== undefined && pose.focalLength35mm;
  if (!complete) return { level: "low", renderAsOverlay: false, label: "Metadados incompletos — referência GPS" };
  const pitch = Math.abs(pose.gimbalPitchDegree!);
  if (pitch < 60) return { level: "low", renderAsOverlay: false, label: "Imagem oblíqua — referência GPS" };
  if (pitch < 75) return { level: "medium", renderAsOverlay: true, label: "Projecção aproximada" };
  return { level: "high", renderAsOverlay: true, label: "Captura próxima de nadir" };
}

export function photoGroundSize(pose: PhotoPose) {
  const altitude = Math.max(1, pose.relativeAltitudeM ?? 80);
  const aspect = Math.max(0.25, Math.min(4, (pose.imageWidth ?? 3) / (pose.imageHeight ?? 2)));
  const focal35 = Math.max(10, pose.focalLength35mm ?? 28);
  const horizontalFov = 2 * Math.atan(36 / (2 * focal35));
  const widthM = Math.max(15, Math.min(500, 2 * altitude * Math.tan(horizontalFov / 2)));
  return { widthM, heightM: widthM / aspect };
}

export function boundsFromPoints(points: GeoPoint[], bufferM = 200): GeoBounds | null {
  if (!points.length) return null;
  const centerLat = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const latitudeBuffer = bufferM / 111_320;
  const longitudeBuffer = bufferM / Math.max(1, 111_320 * Math.cos(centerLat * Math.PI / 180));
  return {
    west: Math.min(...points.map(point => point.longitude)) - longitudeBuffer,
    south: Math.min(...points.map(point => point.latitude)) - latitudeBuffer,
    east: Math.max(...points.map(point => point.longitude)) + longitudeBuffer,
    north: Math.max(...points.map(point => point.latitude)) + latitudeBuffer,
  };
}

export function geoToPercent(point: GeoPoint, bounds: GeoBounds) {
  return {
    x: (point.longitude - bounds.west) / (bounds.east - bounds.west) * 100,
    y: (bounds.north - point.latitude) / (bounds.north - bounds.south) * 100,
  };
}

export function boundsToPercent(bounds: GeoBounds, viewport: GeoBounds) {
  const topLeft = geoToPercent({ latitude: bounds.north, longitude: bounds.west }, viewport);
  const bottomRight = geoToPercent({ latitude: bounds.south, longitude: bounds.east }, viewport);
  return { left: topLeft.x, top: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
}

export function metreSizeToPercent(widthM: number, heightM: number, latitude: number, bounds: GeoBounds) {
  const viewportWidthM = Math.max(1, (bounds.east - bounds.west) * 111_320 * Math.cos(latitude * Math.PI / 180));
  const viewportHeightM = Math.max(1, (bounds.north - bounds.south) * 111_320);
  return { width: widthM / viewportWidthM * 100, height: heightM / viewportHeightM * 100 };
}

export function viewportSizeMetres(bounds: GeoBounds) {
  const latitude = (bounds.north + bounds.south) / 2;
  return {
    width: (bounds.east - bounds.west) * EARTH_RADIUS_M * Math.PI / 180 * Math.cos(latitude * Math.PI / 180),
    height: (bounds.north - bounds.south) * EARTH_RADIUS_M * Math.PI / 180,
  };
}
