import { describe, expect, it } from "vitest";
import { addCivilMonths } from "@shared/reporting-calendar";

describe("Regra de reporte APA — três meses civis", () => {
  it("preserva o dia sempre que existe no mês de destino", () => {
    expect(addCivilMonths(Date.UTC(2026, 0, 15, 12), 3)).toBe(Date.UTC(2026, 3, 15, 12));
  });

  it("usa o último dia quando o mês de destino é mais curto", () => {
    expect(addCivilMonths(Date.UTC(2026, 0, 31, 12), 3)).toBe(Date.UTC(2026, 3, 30, 12));
  });

  it("respeita fevereiro em ano bissexto", () => {
    expect(addCivilMonths(Date.UTC(2027, 10, 30, 12), 3)).toBe(Date.UTC(2028, 1, 29, 12));
  });
});
