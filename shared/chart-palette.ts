/**
 * Paleta de dados STAND.
 *
 * Cada variável representa uma semântica de negócio, não um estado de
 * aprovação. Isto evita que séries diferentes usem repetidamente o mesmo
 * verde institucional ou que uma cor de alerta seja interpretada como estado.
 */
export const DATA_SERIES_COLOR = {
  brand: "#00C159",
  navy: "#0A3638",
  electricity: "#146FA5",
  water: "#1583B8",
  fuel: "#C58A05",
  carbon: "#D96822",
  workforce: "#7254B8",
  transport: "#8A5A2B",
  incident: "#B74842",
  magenta: "#B33D76",
} as const;

/** Cores de séries para gráficos de repartição sem semântica própria. */
export const DATA_SERIES_PALETTE = [
  DATA_SERIES_COLOR.electricity,
  DATA_SERIES_COLOR.water,
  DATA_SERIES_COLOR.fuel,
  DATA_SERIES_COLOR.carbon,
  DATA_SERIES_COLOR.workforce,
  DATA_SERIES_COLOR.transport,
  DATA_SERIES_COLOR.magenta,
  DATA_SERIES_COLOR.brand,
] as const;
