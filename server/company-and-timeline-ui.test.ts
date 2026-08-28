import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { groupsWithMeasures } from "../client/src/lib/phase-measure-presentation";

describe("regressões de Empresas e Timeline", () => {
  it("não apresenta uma fase como vazia se uma secção estrutural não tiver medidas", () => {
    const visible = groupsWithMeasures([
      { section: { id: 3 }, measures: [] as Array<{ id: number }> },
      { section: { id: 4 }, measures: [{ id: 101 }] },
      { section: { id: 5 }, measures: [{ id: 102 }, { id: 103 }] },
    ]);

    expect(visible.map(group => group.section)).toEqual([{ id: 4 }, { id: 5 }]);
    expect(visible.flatMap(group => group.measures).map(measure => measure.id)).toEqual([101, 102, 103]);
  });

  it("actualiza as associações empresa-projecto depois de criar uma EEP", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
    expect(source).toContain("utils.projects.allCompanyAssignments.invalidate()");
    expect(source).toContain("onSuccess: async () =>");
  });
});
