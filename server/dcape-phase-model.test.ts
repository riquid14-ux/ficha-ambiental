import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DCAPE_MONITORING_PROGRAMMES,
  DCAPE_OTHER_PLANS,
  DCAPE_PHASES,
  baseDcapeNumber,
  getDcapePhaseForItem,
  isDcapeMeasure,
} from "@shared/phases";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("modelo canónico de fases DCAPE", () => {
  it("expõe exclusivamente as sete fases do ciclo de vida", () => {
    expect(DCAPE_PHASES.map((phase) => phase.key)).toEqual([
      "pre_licenciamento",
      "licenciamento",
      "pre_construcao",
      "construcao",
      "final_construcao",
      "exploracao",
      "desativacao",
    ]);
  });

  it("conta 111 medidas por número principal e mantém os elementos separados", () => {
    const roots = new Set<number>();
    for (let number = 1; number <= 111; number += 1) {
      expect(isDcapeMeasure(String(number))).toBe(true);
      roots.add(baseDcapeNumber(`${number}.1`)!);
    }
    expect(roots.size).toBe(111);
    expect(isDcapeMeasure("PL-1")).toBe(false);
    expect(getDcapePhaseForItem("PL-1")?.key).toBe("pre_licenciamento");
    expect(getDcapePhaseForItem("SL-2")?.key).toBe("licenciamento");
    expect(getDcapePhaseForItem("PC-18")?.key).toBe("pre_construcao");
    expect(getDcapePhaseForItem("CC-24")?.key).toBe("construcao");
  });

  it("preserva os dois quadrados finais da DCAPE", () => {
    expect(DCAPE_MONITORING_PROGRAMMES).toHaveLength(7);
    expect(DCAPE_OTHER_PLANS).toHaveLength(13);
    expect(DCAPE_MONITORING_PROGRAMMES.at(-1)?.archaeology).toBe(true);
    expect(DCAPE_OTHER_PLANS.find((item) => item.number === 10)?.archaeology).toBe(true);
  });

  it("mantém timeline, dashboard e servidor ligados à fonte única", () => {
    const timeline = read("client/src/pages/Timeline.tsx");
    const phases = read("client/src/pages/PhaseMeasures.tsx");
    const dashboard = read("client/src/pages/Dashboard.tsx");
    const router = read("server/routers.ts");

    expect(timeline).toContain('from "@shared/phases"');
    expect(phases).toContain('from "@shared/phases"');
    expect(router).toContain("DCAPE_PHASES");
    expect(timeline).not.toContain('"Execução da Obra"');
    expect(phases).not.toContain('"Execução da Obra"');
    expect(timeline).toContain("DCAPE_MONITORING_PROGRAMMES");
    expect(timeline).toContain("DCAPE_OTHER_PLANS");
    expect(dashboard).toContain("dashboardPhaseProgress");
    expect(dashboard).not.toContain("const isDone = i < 3");
  });

  it("regista a migração que preserva duplicados legados sem os exibir", () => {
    const migration = read("drizzle/0060_normalize_dcape_phases.sql");
    expect(migration).toContain("pre_licenciamento");
    expect(migration).toContain("final_construcao");
    expect(migration).toContain("active = 0");
  });
});
