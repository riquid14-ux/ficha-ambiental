import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

describe("Guia STAND — tema, idioma e catálogo por projeto", () => {
  it("mantém o tema escolhido e o idioma PT/EN persistentes", () => {
    const theme = read("client", "src", "contexts", "ThemeContext.tsx");
    const language = read("client", "src", "contexts", "LanguageContext.tsx");

    expect(theme).toContain('localStorage.getItem(STORAGE_KEY)');
    expect(theme).toContain('root.classList.toggle("dark"');
    expect(language).toContain('localStorage.getItem("app_lang")');
    expect(language).toContain('language === "en"');
  });

  it("mantém as páginas prioritárias ligadas ao contexto de tradução", () => {
    const pages = [
      "DocumentLibrary.tsx",
      "DocumentLibraryAdminTab.tsx",
      "EepRequests.tsx",
      "NotFound.tsx",
      "Operation.tsx",
      "OperationSettingsAdmin.tsx",
      "PartnerDashboard.tsx",
    ];

    for (const page of pages) {
      const source = read("client", "src", "pages", page);
      expect(source, page).toContain('useLanguage');
      expect(source, page).toMatch(/\bt\(/);
    }
  });

  it("isola o catálogo regulatório por projeto sem remover registos existentes", () => {
    const schema = read("drizzle", "schema.ts");
    const routers = read("server", "routers.ts");
    const migration = read("drizzle", "0056_conscious_multiple_man.sql");

    expect(schema).toContain('projectId: int("projectId")');
    expect(routers).toContain("db.getProjectSections(input.projectId)");
    expect(routers).toContain("db.getProjectMeasures(input.projectId)");
    expect(migration).toContain("NEST/SIN01 conserva apenas as medidas aplicáveis à Exploração e à Desativação");
    expect(migration).toContain("60001");
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b/i);
  });

  it("mantém as exportações formais no âmbito do projeto", () => {
    const pdf = read("server", "pdf.ts");
    const history = read("client", "src", "pages", "SubmissionHistory.tsx");

    expect(pdf).toContain("db.getProjectSections(sub.projectId)");
    expect(pdf).toContain("db.getProjectMeasures(sub.projectId)");
    expect(pdf).toContain("eq(wsTbl.projectId, projectId)");
    expect(history).toContain("projectId: String(activeProject.id)");
  });
});
