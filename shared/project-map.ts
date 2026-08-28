export const DEFAULT_PROJECT_MAP = {
  fileKey: "platform-basemaps/sines_dgt_ortos2018.png",
  url: "/manus-storage/sines_dgt_ortos2018_332642c9.png",
  referenceCenter: {
    latitude: 37.9525,
    longitude: -8.87,
  },
  referenceRadiusM: 1000,
  bounds: {
    west: -8.88139,
    south: 37.943517,
    east: -8.85861,
    north: 37.961483,
  },
  rasterBounds: {
    west: -8.885,
    south: 37.94,
    east: -8.855,
    north: 37.965,
  },
  sourceName: "Direção-Geral do Território — Ortofotos 2018",
  sourceUrl: "https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-topografica/ortofotos/ortofotos-digitais",
  attribution: "© Direção-Geral do Território",
  license: "CC BY 4.0",
} as const;

export const MAP_READ_ROLES = ["admin", "dono_obra", "pm"] as const;
