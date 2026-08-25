import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { isWeeklyControlMeasureNumber } from "@shared/weekly-control";
import { generateWeeklyControlPdfBuffer, selectWeeklyControlMeasures } from "./weekly-control-pdf";

const sections = [
  { id: 1, orderIndex: 1, phase: "Preparação Prévia", name: "MEDIDAS DA DCAPE A CONSIDERAR NA FASE DE PREPARAÇÃO PRÉVIA À EXECUÇÃO DA OBRA" },
  { id: 2, orderIndex: 2, phase: "Preparação Prévia", name: "Medidas a Considerar na Fase Prévia ao início dos trabalhos da Obra" },
];

function buildMeasures(count = 156) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    number: index === count - 1 ? "111.5" : String(index + 1),
    description: index === 0
      ? "Descrição integral da medida de teste, suficientemente longa para provar que o renderer não corta o texto aos oitenta caracteres e mantém todo o conteúdo original."
      : `Medida de minimização ambiental número ${index + 1}, com conteúdo integral para validação de paginação.`,
    responsible: index % 2 === 0 ? "EE" : "DO | EE",
    sectionId: 2,
    orderIndex: index + 1,
  }));
}

async function parsePdf(buffer: Buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const text = await parser.getText();
    const info = await parser.getInfo({ parsePageInfo: true });
    return { text: text.text, info };
  } finally {
    await parser.destroy();
  }
}

describe("PDF formal da ficha semanal", () => {
  it("identifica apenas números do modelo semanal e exclui códigos exclusivos da Timeline", () => {
    expect(isWeeklyControlMeasureNumber("1")).toBe(true);
    expect(isWeeklyControlMeasureNumber("11.5")).toBe(true);
    expect(isWeeklyControlMeasureNumber("111.5")).toBe(true);
    expect(isWeeklyControlMeasureNumber("PC-1")).toBe(false);
    expect(isWeeklyControlMeasureNumber("EX-3")).toBe(false);

    const selected = selectWeeklyControlMeasures([
      ...buildMeasures(3),
      { id: 800, number: "PC-1", orderIndex: 1, sectionId: 30004 },
      { id: 801, number: "EX-1", orderIndex: 1, sectionId: 30003 },
    ]);
    expect(selected.map((measure) => measure.number)).toEqual(["1", "2", "111.5"]);
  });

  it("gera o modelo horizontal paginado com 156 medidas, texto completo e validação final", async () => {
    const measures = buildMeasures();
    const pdf = await generateWeeklyControlPdfBuffer({
      submission: {
        id: 480001,
        companyId: 1,
        projectId: 1,
        weekNumber: 34,
        weekYear: 2026,
        weekStartDate: "2026-08-17",
        weekEndDate: "2026-08-23",
        status: "approved",
        submittedAt: Date.UTC(2026, 7, 19, 8, 58),
        reviewedAt: Date.UTC(2026, 7, 19, 9, 1),
        reviewNotes: "Observação geral de aprovação.",
      },
      company: { name: "Start Campus", shortName: "SC", logoUrl: null },
      project: { code: "SIN02", name: "SIN02" },
      reviewer: { fullName: "Rita Monteiro", email: "rom@example.test" },
      sections,
      measures: [
        ...measures,
        { id: 900, number: "PC-1", description: "Não pertence ao Word", responsible: "DO", sectionId: 30004, orderIndex: 1 },
      ],
      responses: [{ id: 10, submissionId: 480001, measureId: 1, status: "C", observations: "Observação real da medida." }],
      evidence: [{
        responseId: 10,
        filename: "evidencia.png",
        mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
      }],
      measureReviews: [{ measureId: 1, verdict: "ok", comment: "Medida validada pela RAA." }],
      reviewComments: [{ measureId: 1, comment: "Comentário auditável da revisão." }],
      companyLogo: null,
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const parsed = await parsePdf(pdf);
    expect(parsed.info.total).toBeGreaterThan(10);
    expect(parsed.info.pages[0]?.width).toBeGreaterThan(parsed.info.pages[0]?.height || 0);
    expect(parsed.text).toContain("FICHA DE CONTROLO DE MEDIDAS DE GESTÃO");
    expect(parsed.text).toContain("Semana Nº 34");
    expect(parsed.text).toContain("REV.002 · APROVADA");
    expect(parsed.text).toContain("Descrição integral da medida de teste");
    expect(parsed.text).toContain("mantém todo o conteúdo original");
    expect(parsed.text).toContain("Observação real da medida");
    expect(parsed.text).toContain("Revisão RAA: Medida validada pela RAA.");
    expect(parsed.text).toContain("Comentário: Comentário auditável da revisão.");
    expect(parsed.text).toContain("Evidências anexadas: 1");
    expect(parsed.text).toContain("VALIDAÇÃO FINAL DA FICHA");
    expect(parsed.text).toContain("Responsável pela revisão: Rita Monteiro");
    expect(parsed.text).toContain("111.5");
    expect(parsed.text).not.toContain("PC-1");
    expect(parsed.text).not.toContain("Não pertence ao Word");
    expect(parsed.text).not.toContain("Medida DCAPE -");
  }, 30_000);

  it("mantém submetida e aprovada como únicos estados exportáveis e distingue os nomes na interface", () => {
    const pdfRoutes = readFileSync(new URL("./pdf.ts", import.meta.url), "utf8");
    const historyPage = readFileSync(new URL("../client/src/pages/SubmissionHistory.tsx", import.meta.url), "utf8");
    expect(pdfRoutes).toContain('sub.status !== "submitted" && sub.status !== "approved"');
    expect(pdfRoutes).toContain("O PDF formal só pode ser gerado após submissão ou aprovação da ficha.");
    expect(pdfRoutes).toContain('sub.status === "approved" ? "APROVADA" : "SUBMETIDA"');
    expect(historyPage).toContain('sub.status === "approved" ? "PDF aprovado" : "PDF para revisão"');
  });

  it("aplica o mesmo filtro de 156 medidas no preenchimento, revisão e renderer", () => {
    const weeklyForm = readFileSync(new URL("../client/src/pages/WeeklyForm.tsx", import.meta.url), "utf8");
    const reviewPage = readFileSync(new URL("../client/src/pages/ReviewPage.tsx", import.meta.url), "utf8");
    const renderer = readFileSync(new URL("./weekly-control-pdf.ts", import.meta.url), "utf8");
    expect(weeklyForm).toContain("isWeeklyControlMeasureNumber(m.number)");
    expect(reviewPage).toContain("if (!isWeeklyControlMeasureNumber(m.number)) continue;");
    expect(renderer).toContain("isWeeklyControlMeasureNumber(measure.number)");
  });
});
