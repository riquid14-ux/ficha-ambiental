import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("PM — acesso por projeto e módulo", () => {
  const schema = read("drizzle/schema.ts");
  const database = read("server/db.ts");
  const router = read("server/routers.ts");
  const pdf = read("server/pdf.ts");
  const documents = read("server/document-library.ts");
  const admin = read("client/src/pages/AdminPanel.tsx");

  it("persiste módulos opcionais junto da atribuição utilizador-projeto", () => {
    expect(schema).toContain('accessModules: varchar("accessModules", { length: 1000 })');
    expect(database).toContain("setUserProjectAccessModules");
    expect(database).toContain("accessModules: accessByProject.get(projectId) ?? null");
  });

  it("só permite ao administrador configurar módulos de PM nos seus projetos atribuídos", () => {
    expect(router).toContain("setPmAccessModules: adminProcedure");
    expect(router).toContain('!user || user.role !== "pm"');
    expect(router).toContain("O PM só pode receber permissões nos projectos que lhe estão atribuídos.");
    expect(router).toContain("pm_project_access_configured");
  });

  it("aplica a restrição fora do menu, incluindo KPI, resíduos, documentação e relatórios", () => {
    expect(router).toContain("assertPmModuleAccess");
    expect(router).toContain('module === "waste" ? "residuos" : "kpi"');
    expect(router).toContain('assertProjectFeatureAccess(ctx.user, projectId, "documentacao")');
    expect(pdf).toContain('canExportProjectPdf(user, projectId, "planos")');
    expect(pdf).toContain('canExportProjectPdf(user, projectId, "timeline")');
    expect(documents).toContain("pmCanReadDocuments(item)");
  });

  it("expõe a configuração na Administração sem conceder aprovação de fichas ao PM", () => {
    expect(admin).toContain('candidate.role === "pm"');
    expect(admin).toContain("PM — Gestão de Projeto");
    expect(admin).toContain("Configurar acesso do PM");
    expect(admin).toContain("não são atribuídas ao PM");
  });
});
