import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const root = resolve(import.meta.dirname, "..");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migrationSource = readFileSync(resolve(root, "drizzle/0028_massive_pretty_boy.sql"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const trpcSource = readFileSync(resolve(root, "server/_core/trpc.ts"), "utf8");
const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");
const layoutSource = readFileSync(resolve(root, "client/src/components/AppLayout.tsx"), "utf8");
const adminSource = readFileSync(resolve(root, "client/src/pages/AdminPanel.tsx"), "utf8");
const kpiSource = readFileSync(resolve(root, "client/src/pages/KPI.tsx"), "utf8");
const wasteSource = readFileSync(resolve(root, "client/src/pages/MIRR.tsx"), "utf8");
const welcomeSource = readFileSync(resolve(root, "client/src/pages/Welcome.tsx"), "utf8");

function partnerContext(role: "admin" | "dono_obra" | "pm" | "ee_partner" | "observador" = "ee_partner") {
  return {
    user: {
      id: 780,
      openId: `test-${role}`,
      email: `${role}@example.invalid`,
      name: "Utilizador de teste",
      loginMethod: "password",
      role,
      companyId: 88,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: () => undefined },
  } as unknown as TrpcContext;
}

describe("EEP — Entidade Executante Parceira — modelo e isolamento", () => {
  it("acrescenta o role e a configuração hierárquica sem migração destrutiva", () => {
    expect(schemaSource).toContain('"ee_partner"');
    expect(schemaSource).toContain('mysqlTable("partner_access_profiles"');
    for (const field of ["parentCompanyId", "allowKpi", "allowWaste", "active"]) expect(schemaSource).toContain(`${field}:`);
    expect(migrationSource).not.toMatch(/\b(DROP|TRUNCATE|DELETE|RENAME)\b/i);
  });

  it("bloqueia o parceiro por defeito nas rotas protegidas", async () => {
    expect(trpcSource).toContain('if (ctx.user.role === "ee_partner")');
    await expect(appRouter.createCaller(partnerContext()).audit.list({ limit: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permite apenas KPI, Resíduos e projectos através do procedimento explícito", () => {
    expect(routerSource).toContain("partnerAllowedProcedure");
    expect(routerSource).toContain("assertPartnerProjectModuleAccess");
    expect(layoutSource).toContain('partnerAccess?.allowWaste ? "/residuos" : null');
    expect(layoutSource).toContain('partnerAccess?.allowKpi ? "/kpi" : null');
    expect(layoutSource).toContain('userRole !== "ee_partner" && <NotificationBell />');
    expect(layoutSource).toContain("void logout().finally");
    expect(layoutSource).toContain('window.location.href = "/login"');
    expect(welcomeSource).toContain('enabled: userRole !== "ee_partner"');
  });

  it("valida a EE principal e limita projectos à intersecção autorizada", () => {
    const block = routerSource.slice(routerSource.indexOf("partners: router"), routerSource.indexOf("dashboard: router"));
    expect(block).toContain("A empresa principal deve ser uma EE");
    expect(block).toContain("parentProjectIds.has(projectId)");
    expect(block).toContain("db.setUserProjects(input.userId, input.projectIds)");
    expect(adminSource).toContain("Os projectos disponíveis são sempre limitados aos projectos da EE principal");
  });
});

describe("EEP — Entidade Executante Parceira — KPI e Resíduos", () => {
  it("guarda KPI parciais por empresa contributora sem sobrepor a EE ou outros parceiros", () => {
    expect(schemaSource).toContain('mysqlTable("kpi_submissions"');
    expect(schemaSource).toContain('mysqlEnum("sourceType", ["ee", "ee_partner"])');
    expect(schemaSource).toContain("kpi_submissions_contribution_unique");
    expect(routerSource).toContain('sourceType = "ee_partner"');
    expect(kpiSource).toContain("Submeter contributo parcial");
  });

  it("permite à EE principal ler a consolidação dos seus parceiros e mantém o parceiro isolado", () => {
    expect(dbSource).toContain("getPartnerAllowedProjectIds");
    expect(dbSource).toContain("filters?.networkCompanyId");
    expect(dbSource).toContain("eq(wasteEgars.parentCompanyId, filters.networkCompanyId)");
    expect(routerSource).toContain("getActivePartnerProfile");
    expect(kpiSource).toContain("A EE");
    expect(kpiSource).toContain("matriz consolidada");
    expect(kpiSource).toContain("A carregar submissões consolidadas");
    expect(kpiSource).toContain("matrixQuery.isLoading");
  });

  it("torna subprojectos de Resíduos persistentes e elimina o falso localStorage", () => {
    expect(schemaSource).toContain('mysqlTable("waste_subprojects"');
    expect(schemaSource).toContain("waste_subprojects_project_name_unique");
    expect(wasteSource).toContain("wasteEgars.subprojects.useQuery");
    expect(wasteSource).toContain("wasteEgars.createSubproject.useMutation");
    expect(wasteSource).not.toContain("mirr-subprojects-");
    expect(wasteSource).not.toContain("setSubProjects");
  });

  it("identifica subprojecto e entidade contributora na tabela e exportação", () => {
    expect(wasteSource).toContain("e.subProjectName");
    expect(wasteSource).toContain("e.companyName");
    expect(wasteSource).toContain("Entidade contributora");
    expect(routerSource).toContain("subProjectId: input.subProjectId ?? null");
  });
});

describe("Remoção do módulo de mapas", () => {
  it("não deixa rota, menu, procedimentos, modelos nem ficheiros cartográficos na aplicação activa", () => {
    const appSource = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
    const modulesSource = readFileSync(resolve(root, "client/src/lib/project-modules.ts"), "utf8");
    expect(appSource).not.toContain('path="/mapa"');
    expect(layoutSource).not.toContain('label: "Mapa"');
    expect(routerSource).not.toContain("projectMap: router");
    expect(Object.keys((appRouter as any)._def.procedures)).not.toContain("projectMap.list");
    expect(schemaSource).not.toContain('mysqlTable("project_map_settings"');
    expect(modulesSource).not.toContain('"map"');
    for (const file of [
      "client/src/pages/ProjectMap.tsx",
      "client/src/components/ProjectMapCanvas.tsx",
      "client/src/components/Map.tsx",
      "client/src/lib/project-map-geometry.ts",
      "shared/project-map.ts",
      "server/photogrammetry.ts",
      "server/photogrammetry-worker.ts",
    ]) expect(existsSync(resolve(root, file))).toBe(false);
  });
});
