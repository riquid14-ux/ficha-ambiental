import { describe, expect, it } from "vitest";
import { isProjectRouteEnabled, parseProjectModules } from "../client/src/lib/project-modules";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("módulos autorizados por projecto", () => {
  const acpModules = JSON.stringify(["dashboard", "calendar", "residuos", "kpi"]);

  it("mantém ACP limitado a Dashboard, Calendário, Resíduos e KPI", () => {
    expect(parseProjectModules(acpModules)).toEqual(["dashboard", "calendar", "residuos", "kpi"]);
    expect(isProjectRouteEnabled(acpModules, "/dashboard")).toBe(true);
    expect(isProjectRouteEnabled(acpModules, "/calendario")).toBe(true);
    expect(isProjectRouteEnabled(acpModules, "/residuos")).toBe(true);
    expect(isProjectRouteEnabled(acpModules, "/kpi")).toBe(true);
    expect(isProjectRouteEnabled(acpModules, "/ficha")).toBe(false);
    expect(isProjectRouteEnabled(acpModules, "/timeline")).toBe(false);
  });

  it("recupera o conjunto completo quando a configuração persistida for inválida", () => {
    expect(parseProjectModules("inválido")).toContain("ficha");
    expect(parseProjectModules(null)).not.toContain("map");
  });

  it("exige Admin e grava auditoria ao criar ou configurar módulos de um projecto", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const projectBlock = router.slice(router.indexOf("create: adminProcedure"), router.indexOf("getCompanyAssignments"));
    expect(projectBlock).toContain("enabledModules: z.array");
    expect(projectBlock).toContain('"project_created"');
    expect(projectBlock).toContain('"project_updated"');
  });
});
