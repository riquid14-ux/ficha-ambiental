import { describe, expect, it } from "vitest";
import { DATA_SERIES_COLOR, DATA_SERIES_PALETTE } from "../shared/chart-palette";

describe("paleta de dados STAND", () => {
  it("mantém cores semânticas distintas para os indicadores que não representam estados", () => {
    expect(DATA_SERIES_COLOR.electricity).not.toBe(DATA_SERIES_COLOR.water);
    expect(DATA_SERIES_COLOR.water).not.toBe(DATA_SERIES_COLOR.carbon);
    expect(DATA_SERIES_COLOR.carbon).not.toBe(DATA_SERIES_COLOR.fuel);
    expect(DATA_SERIES_COLOR.workforce).not.toBe(DATA_SERIES_COLOR.transport);
    expect(DATA_SERIES_COLOR.incident).not.toBe(DATA_SERIES_COLOR.brand);
  });

  it("oferece uma sequência sem repetições para gráficos de repartição", () => {
    expect(new Set(DATA_SERIES_PALETTE).size).toBe(DATA_SERIES_PALETTE.length);
    expect(DATA_SERIES_PALETTE).toContain(DATA_SERIES_COLOR.electricity);
    expect(DATA_SERIES_PALETTE).toContain(DATA_SERIES_COLOR.water);
    expect(DATA_SERIES_PALETTE).toContain(DATA_SERIES_COLOR.carbon);
  });
});
