import { describe, expect, it } from "vitest";
import { buildRdcdNonConformityRows, buildRdcdPhaseRows, buildRdcdWeeklyRows } from "../client/src/lib/rdcd-template";

const submissions = [{ id: 9, weekNumber: 12, weekYear: 2026, weekStartDate: "2026-03-16", weekEndDate: "2026-03-22", reviewNotes: "Validar barreira." }];
const measures = [
  { id: 1, number: "17", sectionId: 10, description: "Medida de execução" },
  { id: 2, number: "18", sectionId: 10, description: "Segunda medida" },
];
const sections = [{ id: 10, name: "Execução da Obra" }];
const responses = [
  { submissionId: 9, measureId: 1, status: "I", observations: null },
  { submissionId: 9, measureId: 2, status: "NC", observations: "Corrigir sinalização." },
];

describe("estrutura RDCD SIN02", () => {
  it("cria uma linha semanal por ficha com I, C, NC, NA, fases e observações", () => {
    const [row] = buildRdcdWeeklyRows(submissions, responses, measures, sections);
    expect(row).toMatchObject({ reference: "ID 9", week: 12, i: 1, c: 0, nc: 1, na: 0, phases: "Execução da Obra" });
    expect(row.observations).toContain("Validar barreira");
  });

  it("mantém a fase declarada pelo relatório curta na tabela semanal", () => {
    const [row] = buildRdcdWeeklyRows(submissions, responses, measures, sections, "Execução da obra");
    expect(row.phases).toBe("Execução da obra");
  });

  it("consolida as respostas por fase e isola não conformidades e observações", () => {
    expect(buildRdcdPhaseRows(responses, measures, sections)).toEqual([{ section: "Execução da Obra", totalMeasures: 2, i: 1, c: 0, nc: 1, na: 0 }]);
    const findings = buildRdcdNonConformityRows(responses, measures, submissions);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ number: "18", finding: "Não Conforme", reference: "S12/2026 · ID 9" });
  });
});
