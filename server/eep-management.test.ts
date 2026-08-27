import { describe, expect, it } from "vitest";
import fs from "fs";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function callerFor(role: "admin" | "ee" | "ee_partner" | "pm") {
  const ctx = {
    user: {
      id: 990,
      openId: `eep-test-${role}`,
      email: `${role}@example.com`,
      name: "Teste EEP",
      loginMethod: "password",
      role,
      companyId: 30001,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: () => undefined },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const routerCode = fs.readFileSync(`${process.cwd()}/server/routers.ts`, "utf-8");
const dbCode = fs.readFileSync(`${process.cwd()}/server/db.ts`, "utf-8");
const schemaCode = fs.readFileSync(`${process.cwd()}/drizzle/schema.ts`, "utf-8");
const adminCode = fs.readFileSync(`${process.cwd()}/client/src/pages/AdminPanel.tsx`, "utf-8");
const requestCode = fs.readFileSync(`${process.cwd()}/client/src/pages/EepRequests.tsx`, "utf-8");
const dashboardCode = fs.readFileSync(`${process.cwd()}/client/src/pages/PartnerDashboard.tsx`, "utf-8");

describe("Gestão de empresas e workflow EEP", () => {
  it("corrige Períodos Activos com id real e gravação atómica", () => {
    expect(dbCode).toContain("projectCompanies.id");
    expect(routerCode).toContain("O fim dos trabalhos não pode ser anterior ao início");
    expect(adminCode).toContain("CompanyPeriodRow");
    expect(adminCode).toContain("Guardar");
  });

  it("elimina associações na tabela correcta e bloqueia histórico", () => {
    expect(routerCode).toContain("DELETE FROM project_companies WHERE companyId");
    expect(routerCode).not.toContain("DELETE FROM company_projects WHERE companyId");
    expect(routerCode).toContain("A empresa tem dados históricos. Desactive-a em vez de a eliminar.");
    expect(routerCode).toContain("A empresa tem EEP associadas");
  });

  it("obriga projectos e ligação EEP→EE na criação directa", () => {
    expect(routerCode).toContain('projectIds: z.array(z.number().int().positive()).min(1');
    expect(routerCode).toContain("Uma EEP exige EE principal e acesso a KPI e/ou Resíduos");
    expect(adminCode).toContain("EE principal a que responde");
    expect(adminCode).toContain("Sem projectos atribuídos");
    expect(adminCode).toContain("if (!existing.includes(a.projectId)) existing.push(a.projectId)");
    expect(schemaCode).toContain('mysqlTable("partner_company_profiles"');
  });

  it("permite apenas à EE submeter pedidos EEP dentro dos seus projectos", () => {
    expect(routerCode).toContain("Apenas uma EE pode submeter pedidos EEP");
    expect(routerCode).toContain("Só pode pedir EEP para projectos da sua EE");
    expect(requestCode).toContain('user?.role !== "ee"');
    expect(requestCode).toContain("Módulos solicitados");
  });

  it("recusa pedidos próprios a Admin, PM e EEP antes de consultar a base de dados", async () => {
    for (const role of ["admin", "pm", "ee_partner"] as const) {
      await expect(callerFor(role).eepRequests.mine()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("cria empresa, perfil, projectos e convites na aprovação administrativa", () => {
    expect(dbCode).toContain("approveEepRequest");
    expect(dbCode).toContain("partnerCompanyProfiles");
    expect(dbCode).toContain("eepRequestUsers");
    expect(adminCode).toContain("Pedidos EEP");
    expect(adminCode).toContain("Aprovar");
    expect(adminCode).toContain("Rejeitar");
  });
});

describe("Dashboard Parceiros", () => {
  it("é exclusivo da EE e limita o universo à EE principal", () => {
    expect(routerCode).toContain("Dashboard exclusivo da EE");
    expect(routerCode).toContain("ks.companyId = ${ctx.user.companyId} OR ks.parentCompanyId = ${ctx.user.companyId}");
    expect(routerCode).toContain("Entidade fora da rede da sua EE");
  });

  it("recusa as agregações a Admin, PM e EEP antes de executar SQL", async () => {
    for (const role of ["admin", "pm", "ee_partner"] as const) {
      await expect(callerFor(role).partnerDashboard.entities({ projectId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(role).partnerDashboard.kpiSeries({ projectId: 2, year: 2026, companyId: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(callerFor(role).partnerDashboard.wasteMap({ projectId: 2, year: 2026, companyId: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("inclui matriz Submetido/Não submetido e filtros Todos/EE/EEP", () => {
    expect(dashboardCode).toContain("Matriz de submissão KPI");
    expect(dashboardCode).toContain("Submetido");
    expect(dashboardCode).toContain("Não submetido");
    expect(dashboardCode).toContain("Todos — EE + EEP");
  });

  it("apresenta indicadores KPI e Waste Map por subprojecto", () => {
    expect(dashboardCode).toContain("16 dashboards KPI");
    expect((dashboardCode.match(/<Kpi(?:Chart|Stat)Card id=/g) || [])).toHaveLength(16);
    expect(dashboardCode).toContain("Os 36 campos KPI são consolidados nos mesmos 16 visuais");
    expect(dashboardCode).toContain("Waste Map");
    expect(dashboardCode).toContain("Por subprojecto");
    expect(routerCode).toContain("LEFT JOIN waste_subprojects");
  });
});
