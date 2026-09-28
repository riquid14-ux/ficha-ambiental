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
import { logicalDcapeItems, phaseLogicalSummary } from "../client/src/lib/dcape-presentation";

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
    expect(getDcapePhaseForItem("EX-1")?.key).toBe("exploracao");
    expect(isDcapeMeasure("EX-19")).toBe(true);
  });

  it("inclui elementos documentais no progresso sem os confundir com medidas", () => {
    const items = [
      { id: 1, number: "PL-1", description: "Elemento PL", sectionId: 1 },
      { id: 2, number: "PL-2", description: "Elemento PL", sectionId: 1 },
      { id: 3, number: "1", description: "Medida", sectionId: 2 },
    ];
    const summary = phaseLogicalSummary(items, "pre_licenciamento", {
      1: { trackingStatus: "concluido" },
      2: { trackingStatus: "concluido" },
    });
    expect(summary.total).toBe(2);
    expect(summary.measureTotal).toBe(0);
    expect(summary.elementTotal).toBe(2);
    expect(summary.concluded).toBe(2);
    expect(summary.pending).toBe(0);
  });

  it("atribui as 136 obrigações SIN02 a uma e uma só fase, com os totais regulamentares", () => {
    const elements = [
      ...Array.from({ length: 3 }, (_, index) => `PL-${index + 1}`),
      ...Array.from({ length: 2 }, (_, index) => `SL-${index + 4}`),
      ...Array.from({ length: 18 }, (_, index) => `PC-${index + 6}`),
      ...Array.from({ length: 2 }, (_, index) => `CC-${index + 24}`),
    ];
    const catalogue = [
      ...elements,
      ...Array.from({ length: 111 }, (_, index) => String(index + 1)),
      // Linhas históricas preservadas no catálogo de obra; as medidas
      // canónicas 92–110 prevalecem e a Timeline não as duplica.
      ...Array.from({ length: 19 }, (_, index) => `EX-${index + 1}`),
    ].map((number, index) => ({ id: index + 1, number, description: `Obrigação ${number}`, sectionId: 1 }));

    const expected = {
      pre_licenciamento: { total: 3, elements: 3, measures: 0 },
      licenciamento: { total: 2, elements: 2, measures: 0 },
      pre_construcao: { total: 34, elements: 18, measures: 16 },
      construcao: { total: 72, elements: 2, measures: 70 },
      final_construcao: { total: 5, elements: 0, measures: 5 },
      exploracao: { total: 19, elements: 0, measures: 19 },
      desativacao: { total: 1, elements: 0, measures: 1 },
    } as const;

    const occurrences = new Map<string, number>();
    for (const phase of DCAPE_PHASES) {
      const items = logicalDcapeItems(catalogue, phase.key);
      const summary = phaseLogicalSummary(catalogue, phase.key);
      expect(summary.total).toBe(expected[phase.key].total);
      expect(summary.elementTotal).toBe(expected[phase.key].elements);
      expect(summary.measureTotal).toBe(expected[phase.key].measures);
      for (const item of items) occurrences.set(item.key, (occurrences.get(item.key) || 0) + 1);
    }

    expect(occurrences.size).toBe(136);
    expect(Array.from(occurrences.values())).toEqual(Array.from({ length: 136 }, () => 1));
  });

  it("preserva as 19 medidas EX como exploração quando SIN01 não tem a numeração 92–110", () => {
    const sin01 = [
      ...Array.from({ length: 19 }, (_, index) => `EX-${index + 1}`),
      "111",
      "111.1",
      "DA-1",
    ].map((number, index) => ({ id: index + 1, number, description: `Obrigação ${number}`, sectionId: 1 }));

    expect(phaseLogicalSummary(sin01, "exploracao").total).toBe(19);
    expect(phaseLogicalSummary(sin01, "desativacao").total).toBe(1);
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
