import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatMonitoringPlanSubmissionStatus, formatPhaseEvidenceLines, resolveTimelineSectionPhase } from "./pdf";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Âmbito de projeto — documentação, mapa e relatórios", () => {
  it("oculta a hierarquia de empresas e Documentação na visão Todos os Projetos", () => {
    const admin = read("client/src/pages/AdminPanel.tsx");
    const navigation = read("client/src/lib/role-navigation.ts");
    expect(admin).toContain("!isAllProjects && activeProject");
    expect(navigation).toContain('"/documentacao"');
    expect(navigation).toContain("if (isAllProjects) return");
    expect(navigation).not.toMatch(/GLOBAL_ROUTES = \[[^\]]*"\/documentacao"/);
  });

  it("protege relatórios PDF de Fases e Planos por projeto autenticado", () => {
    const pdf = read("server/pdf.ts");
    expect(pdf).toContain('app.get("/api/pdf/fases/:projectId"');
    expect(pdf).toContain('app.get("/api/pdf/planos/:projectId"');
    expect(pdf).toContain("canExportProjectPdf");
    expect(pdf).toContain("RELATÓRIO DE FASES");
    expect(pdf).toContain("RELATÓRIO DE PLANOS DE MONITORIZAÇÃO");
  });

  it("inclui evidências auditáveis por ponto no PDF de Fases sem expor URLs privadas", () => {
    const lines = formatPhaseEvidenceLines([
      { type: "comment", content: "Vistoria concluída no local.", createdByName: "Rita Monteiro", createdAt: "2026-09-10" },
      { type: "photo", content: "https://storage.example.test/private/photo.jpg", filename: "vistoria-frente-norte.jpg", createdByName: "Rita Monteiro", createdAt: "2026-09-10" },
      { type: "file", content: "https://storage.example.test/private/anexo.pdf", filename: "auto-vistoria.pdf", createdByName: "João Silva", createdAt: "2026-09-09" },
    ]);
    expect(lines).toContain("Comentário: Vistoria concluída no local. — Rita Monteiro, 10/09/2026");
    expect(lines).toContain("Foto: vistoria-frente-norte.jpg — Rita Monteiro, 10/09/2026");
    expect(lines).toContain("Ficheiro: auto-vistoria.pdf — João Silva, 09/09/2026");
    expect(lines.join("\n")).not.toContain("storage.example.test");
    expect(read("server/pdf.ts")).toContain("Evidências do ponto");
  });

  it("usa as mesmas equivalências de fase da Timeline ao compor o PDF", () => {
    expect(resolveTimelineSectionPhase({ phaseKey: "previas_licenciamento", phaseName: "Previamente ao Licenciamento" })).toBe("Prévias Licenciamento");
    expect(resolveTimelineSectionPhase({ phaseKey: "desativacao", phaseName: "Desativação" })).toBe("Desativação (Pós-Exploração)");
    expect(resolveTimelineSectionPhase({ phaseKey: "Execução da Obra", phaseName: "Construção" })).toBe("Execução da Obra");
  });

  it("exporta os estados de entrega de Planos em português", () => {
    expect(formatMonitoringPlanSubmissionStatus("pending")).toBe("Pendente");
    expect(formatMonitoringPlanSubmissionStatus("submitted")).toBe("Submetido");
    expect(formatMonitoringPlanSubmissionStatus("delivered")).toBe("Entregue");
  });
});
