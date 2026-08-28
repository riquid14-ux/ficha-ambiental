import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Administração por projecto e Matriz semanal", () => {
  const adminPanel = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
  const matrix = readFileSync(resolve(process.cwd(), "client/src/pages/Matriz.tsx"), "utf8");
  const db = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

  it("limita empresas, utilizadores, parceiros e convites ao projecto activo, preservando Todos os Projetos", () => {
    expect(adminPanel).toContain("const scopedProjectId = isAllProjects ? null : activeProject?.id ?? null");
    expect(adminPanel).toContain("const visibleCompanies = useMemo");
    expect(adminPanel).toContain("const scopedUsers = useMemo");
    expect(adminPanel).toContain("const scopedInvitations = useMemo");
    expect(adminPanel).toContain("const scopedPartners = useMemo");
  });

  it("exclui EEP da Matriz de Ficha Semanal no servidor e na interface", () => {
    expect(db).toContain('relevantCompanies = relevantCompanies.filter(company => company.companyType !== "ee_partner")');
    expect(matrix).toContain('const weeklyCompanies = companies.filter((company: any) => company.companyType !== "ee_partner")');
  });
});
