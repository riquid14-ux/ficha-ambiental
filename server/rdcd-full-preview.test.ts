import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/RDCD.tsx"),
  "utf8",
);

describe("RDCD — pré-visualização documental integral", () => {
  it("compõe a sequência completa do relatório sem limitar a consola ao capítulo ativo", () => {
    expect(source).toContain("const renderFullDocumentPreview = () =>");
    expect(source).toContain('className="rdcd-full-document"');
    expect(source).toContain("documentChapters");
    expect(source).toContain('t("Índice e fontes")');
    expect(source).toContain('t("Anexos técnicos e rastreabilidade")');
    expect(source).toContain('t("WORD · DOCUMENTO COMPLETO")');
  });

  it("mantém o capítulo ativo destacado, a curadoria aprovada e as marcas no documento", () => {
    expect(source).toContain("rdcd-document-sheet--active");
    expect(source).toContain("selectedDocumentMeasures.map");
    expect(source).toContain("selection.selectedWeeks.length");
    expect(source).toContain("reportLogoMediaUrl(logo.url)");
    expect(source).toContain("A pré-visualização organiza fontes e composição.");
  });

  it("apresenta uma síntese por medida e semana, nunca uma linha por GC", () => {
    expect(source).toContain("summarizeWeeklyRdcdResponses");
    expect(source).toContain("selectedWeeklySummaries.map");
    expect(source).toContain("curationPreviewWeeklySummaries.map");
  });
});
