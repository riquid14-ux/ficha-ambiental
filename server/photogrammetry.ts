import type { MapPhoto } from "../drizzle/schema";

export type PhotogrammetryValidationIssue = {
  code: string;
  level: "error" | "warning";
  message: string;
};

export type PhotogrammetryValidation = {
  accepted: boolean;
  imageCount: number;
  geolocatedCount: number;
  nadirCount: number;
  obliqueCount: number;
  missingMetadataCount: number;
  geographicBounds: { west: number; south: number; east: number; north: number } | null;
  issues: PhotogrammetryValidationIssue[];
};

function readMetadata(photo: MapPhoto): Record<string, unknown> {
  try {
    return photo.metadataJson ? JSON.parse(photo.metadataJson) : {};
  } catch {
    return {};
  }
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validatePhotogrammetryBatch(photos: MapPhoto[]): PhotogrammetryValidation {
  const issues: PhotogrammetryValidationIssue[] = [];
  const coordinates: Array<{ latitude: number; longitude: number }> = [];
  let nadirCount = 0;
  let obliqueCount = 0;
  let missingMetadataCount = 0;

  for (const photo of photos) {
    const metadata = readMetadata(photo);
    const latitude = finiteNumber(photo.latitude);
    const longitude = finiteNumber(photo.longitude);
    const pitch = finiteNumber(metadata.gimbalPitchDegree);
    const yaw = finiteNumber(metadata.gimbalYawDegree);
    const altitude = finiteNumber(photo.relativeAltitudeM ?? metadata.relativeAltitudeM);
    const hasCameraDimensions = !!photo.imageWidth && !!photo.imageHeight;

    if (latitude != null && longitude != null) coordinates.push({ latitude, longitude });
    if (pitch != null) {
      const distanceFromNadir = Math.abs(Math.abs(pitch) - 90);
      if (distanceFromNadir <= 5) nadirCount += 1;
      else obliqueCount += 1;
    }
    if (latitude == null || longitude == null || pitch == null || yaw == null || altitude == null || !hasCameraDimensions) {
      missingMetadataCount += 1;
    }
  }

  if (photos.length < 5) {
    issues.push({ code: "MINIMUM_IMAGES", level: "error", message: "O lote precisa de pelo menos 5 fotografias para iniciar a validação fotogramétrica." });
  } else if (photos.length < 10) {
    issues.push({ code: "LIMITED_IMAGE_COUNT", level: "warning", message: "O lote tem poucas fotografias; a qualidade dependerá fortemente da sobreposição real." });
  }

  const geolocatedRatio = photos.length ? coordinates.length / photos.length : 0;
  if (geolocatedRatio < 0.8) {
    issues.push({ code: "INSUFFICIENT_GEOLOCATION", level: "error", message: "Pelo menos 80% das fotografias devem ter coordenadas GPS válidas." });
  }

  if (missingMetadataCount > Math.max(1, Math.floor(photos.length * 0.2))) {
    issues.push({ code: "INCOMPLETE_DJI_METADATA", level: "warning", message: "Mais de 20% das fotografias não têm todos os metadados de posição, altitude, orientação e dimensões." });
  }

  if (nadirCount !== photos.length) {
    const orientationMessage = obliqueCount > 0
      ? `${obliqueCount} fotografia(s) não estão orientadas verticalmente a 90°.`
      : "Não foi possível confirmar a orientação vertical de todas as fotografias.";
    issues.push({ code: "NADIR_90_REQUIRED", level: "error", message: `${orientationMessage} O mosaico só aceita fotografias DJI nadir, apontadas para baixo a 90° (tolerância de 5°).` });
  }

  let geographicBounds: PhotogrammetryValidation["geographicBounds"] = null;
  if (coordinates.length) {
    geographicBounds = {
      west: Math.min(...coordinates.map(item => item.longitude)),
      south: Math.min(...coordinates.map(item => item.latitude)),
      east: Math.max(...coordinates.map(item => item.longitude)),
      north: Math.max(...coordinates.map(item => item.latitude)),
    };
    if (geographicBounds.west === geographicBounds.east || geographicBounds.south === geographicBounds.north) {
      issues.push({ code: "NO_SPATIAL_COVERAGE", level: "warning", message: "As coordenadas não demonstram cobertura espacial; o worker terá de rejeitar o lote se não encontrar sobreposição real." });
    }
  }

  issues.push({ code: "WORKER_OVERLAP_REQUIRED", level: "warning", message: "A sobreposição, nitidez, matching e erro reprojetivo são confirmados pelo worker NodeODM, não pela aplicação web." });

  return {
    accepted: !issues.some(issue => issue.level === "error"),
    imageCount: photos.length,
    geolocatedCount: coordinates.length,
    nadirCount,
    obliqueCount,
    missingMetadataCount,
    geographicBounds,
    issues,
  };
}

export function getPhotogrammetryWorkerStatus() {
  return {
    configured: false,
    healthy: false,
    mode: "private_nodeodm" as const,
    message: "Worker NodeODM privado ainda não configurado. A aplicação permanece disponível e os lotes podem ser preparados e validados.",
  };
}
