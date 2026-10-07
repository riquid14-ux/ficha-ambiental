import { describe, expect, it } from "vitest";
import {
  getWeeklyRdcdKey,
  summarizeWeeklyRdcdResponses,
} from "../client/src/lib/weekly-rdcd-consolidation";

describe("RDCD — consolidação das fichas semanais", () => {
  it("agrupa respostas de vários GCs numa só evidência por medida e semana", () => {
    const summaries = summarizeWeeklyRdcdResponses([
      { submissionId: 11, year: 2026, week: 8, status: "C", observations: "Frente norte verificada." },
      { submissionId: 12, year: 2026, week: 8, status: "C", observations: "Frente norte verificada." },
      { submissionId: 13, year: 2026, week: 8, status: "I", observations: "Evidência complementar anexada." },
      { submissionId: 14, year: 2026, week: 9, status: "NC", observations: "Ação corretiva em acompanhamento." },
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      key: "2026-W08",
      statuses: ["I", "C"],
      observations: ["Frente norte verificada.", "Evidência complementar anexada."],
      sourceSubmissionIds: [11, 12, 13],
    });
    expect(summaries[1]).toMatchObject({
      key: "2026-W09",
      statuses: ["NC"],
      sourceSubmissionIds: [14],
    });
  });

  it("mantém uma chave ISO estável para a seleção guardada no rascunho", () => {
    expect(getWeeklyRdcdKey(2028, 3)).toBe("2028-W03");
  });
});
