import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("KPI — rascunhos, correções e Excel", () => {
  const router = read("server/routers.ts");
  const page = read("client/src/pages/KPI.tsx");

  it("mantém um histórico auditável e limita a correção de EEP à EE principal", () => {
    expect(router).toContain("kpi_submission_changes");
    expect(router).toContain("Só o autor pode editar este KPI; a EE pode corrigir contributos das suas EEP.");
    expect(router).toContain('mode === "correct"');
    expect(router).toContain("actorName");
    expect(router).toContain("changedValues");
    expect(router).toContain("completeWeekSnapshot");
    expect(router).toContain("database.transaction");
  });

  it("mantém rascunhos fora de dashboards e permite retomar uma semana específica", () => {
    expect(router).toContain("ks.status <> 'draft'");
    expect(router).toContain("draft: partnerAllowedProcedure");
    expect(router).toContain("saveDraft: partnerAllowedProcedure");
    expect(page).toContain("Rascunho retomado");
    expect(page).toContain("Guardar todos os KPI da semana");
  });

  it("usa um modelo Excel limitado, com colunas de semana e métrica, e valida a importação no servidor", () => {
    expect(page).toContain('workbook.addWorksheet("Importar KPI")');
    expect(page).toContain('"ID da métrica"');
    expect(page).toContain('`Semana ${week}`');
    expect(page).toContain("preencha apenas as colunas Semana");
    expect(router).toContain("importExcel: partnerAllowedProcedure");
    expect(router).toContain("weekYear: z.number().int().min(2020).max(2100)");
    expect(router).toContain("weekColumns.length > 0");
    expect(router).toContain("worksheet.rowCount > 5001");
    expect(router).toContain("O limite de importação é 53 semanas de cada vez.");
    expect(router).toContain("inputType = 'manual'");
  });
});
