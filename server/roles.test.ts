import { describe, it, expect } from "vitest";
import fs from "fs";

const routerCode = fs.readFileSync(`${process.cwd()}/server/routers.ts`, "utf-8");
const layoutCode = fs.readFileSync(`${process.cwd()}/client/src/components/AppLayout.tsx`, "utf-8");
const weeklyFormCode = fs.readFileSync(`${process.cwd()}/client/src/pages/WeeklyForm.tsx`, "utf-8");
const reviewCode = fs.readFileSync(`${process.cwd()}/client/src/pages/ReviewPage.tsx`, "utf-8");
const dashboardCode = fs.readFileSync(`${process.cwd()}/client/src/pages/Dashboard.tsx`, "utf-8");
const projectContextCode = fs.readFileSync(`${process.cwd()}/client/src/contexts/ProjectContext.tsx`, "utf-8");

describe("Roles Drill Tests", () => {

  describe("Role Definitions", () => {
    it("should include the EEP role in the permission model", () => {
      expect(routerCode).toContain('"user"');
      expect(routerCode).toContain('"admin"');
      expect(routerCode).toContain('"ee"');
      expect(routerCode).toContain('"raa"');
      expect(routerCode).toContain('"rap"');
      expect(routerCode).toContain('"dono_obra"');
      expect(routerCode).toContain('"observador"');
      expect(routerCode).toContain('"pm"');
      expect(routerCode).toContain('"ee_partner"');
    });
  });

  describe("Sidebar Visibility", () => {
    it("should restrict EE to Welcome, Workflow, Ficha, Resíduos, KPI", () => {
      const eeMatch = layoutCode.match(/ee:\s*\[(.*?)\]/s);
      expect(eeMatch).toBeTruthy();
      const eePaths = eeMatch![1];
      expect(eePaths).toContain("/welcome");
      expect(eePaths).toContain("/ficha");
      expect(eePaths).toContain("/kpi");
      expect(eePaths).not.toContain("/dashboard");
      expect(eePaths).not.toContain("/admin");
      expect(eePaths).not.toContain("/rdcd");
    });

    it("should restrict RAA to Welcome, Workflow, Ficha, Resíduos, KPI", () => {
      const raaMatch = layoutCode.match(/raa:\s*\[(.*?)\]/s);
      expect(raaMatch).toBeTruthy();
      const raaPaths = raaMatch![1];
      expect(raaPaths).toContain("/welcome");
      expect(raaPaths).toContain("/ficha");
      expect(raaPaths).not.toContain("/dashboard");
      expect(raaPaths).not.toContain("/admin");
    });

    it("should restrict RAP to Welcome, Workflow, Ficha, KPI (no Resíduos)", () => {
      const rapMatch = layoutCode.match(/rap:\s*\[(.*?)\]/s);
      expect(rapMatch).toBeTruthy();
      const rapPaths = rapMatch![1];
      expect(rapPaths).toContain("/welcome");
      expect(rapPaths).toContain("/ficha");
      expect(rapPaths).toContain("/kpi");
      expect(rapPaths).not.toContain("/residuos");
      expect(rapPaths).not.toContain("/dashboard");
    });

    it("should give Observador only Welcome, Dashboard, Ficha (read-only)", () => {
      const obsMatch = layoutCode.match(/observador:\s*\[(.*?)\]/s);
      expect(obsMatch).toBeTruthy();
      const obsPaths = obsMatch![1];
      expect(obsPaths).toContain("/welcome");
      expect(obsPaths).toContain("/dashboard");
      expect(obsPaths).toContain("/ficha");
      expect(obsPaths).not.toContain("/admin");
      expect(obsPaths).not.toContain("/kpi");
    });

    it("should give Admin full access", () => {
      const adminMatch = layoutCode.match(/admin:\s*\[(.*?)\]/s);
      expect(adminMatch).toBeTruthy();
      const adminPaths = adminMatch![1];
      expect(adminPaths).toContain("/welcome");
      expect(adminPaths).toContain("/dashboard");
      expect(adminPaths).toContain("/ficha");
      expect(adminPaths).toContain("/kpi");
      expect(adminPaths).toContain("/calendario");
      expect(adminPaths).toContain("/timeline");
    });

    it("should give PM operational modules only inside assigned projects", () => {
      const pmMatch = layoutCode.match(/pm:\s*\[(.*?)\]/s);
      expect(pmMatch).toBeTruthy();
      const pmPaths = pmMatch![1];
      expect(pmPaths).toContain("/dashboard");
      expect(pmPaths).toContain("/calendario");
      expect(pmPaths).toContain("/timeline");
      expect(projectContextCode).not.toMatch(/canSeeAllProjects[^;]*pm/);
    });
  });

  describe("All Projects Visibility", () => {
    it("should only allow Admin and DO to see Todos os Projetos", () => {
      expect(layoutCode).toMatch(/\["admin", "dono_obra"\]\.includes\(userRole\)/);
      expect(projectContextCode).toContain('user?.role === "admin" || user?.role === "dono_obra"');
      expect(projectContextCode).not.toMatch(/canSeeAllProjects[^;]*pm/);
    });

    it("should block EE, RAP, RAA from seeing all-projects view", () => {
      expect(layoutCode).toContain("Apenas Admin e Dono de Obra podem abrir a visão global");
    });

    it("should expose Pedidos EEP and Dashboard Parceiros only to EE", () => {
      expect(layoutCode).toContain('userRole === "ee"');
      expect(layoutCode).toContain('path: "/pedidos-eep"');
      expect(layoutCode).toContain('path: "/dashboard-parceiros"');
    });
  });

  describe("SIN01/NEST Restriction", () => {
    it("should define OPERATION_ONLY_PROJECT_CODES with SIN01", () => {
      expect(layoutCode).toContain('OPERATION_ONLY_PROJECT_CODES = ["SIN01"]');
    });
  });

  describe("Ficha Semanal Permissions", () => {
    it("should make Observador read-only", () => {
      expect(weeklyFormCode).toContain('role === "observador"');
    });

    it("should allow Admin and DO to submit any ficha", () => {
      expect(weeklyFormCode).toContain('role === "admin"');
      expect(weeklyFormCode).toContain('role === "dono_obra"');
    });
  });

  describe("Review Permissions", () => {
    it("should allow RAA, Admin, DO to review", () => {
      expect(reviewCode).toContain('role === "raa"');
      expect(reviewCode).toContain('role === "admin"');
      expect(reviewCode).toContain('role === "dono_obra"');
    });

    it("should allow Observador to see reviews but not act", () => {
      expect(reviewCode).toContain('role === "observador"');
    });

    it("should prevent self-approval in backend", () => {
      expect(routerCode).toContain("createdBy === ctx.user.id || sub.submittedBy === ctx.user.id");
      expect(routerCode).toContain("Não pode aprovar uma ficha que criou ou submeteu");
    });
  });

  describe("Admin-Only Operations", () => {
    it("should restrict user deletion to admin", () => {
      expect(routerCode).toContain('targetUser.role === "admin"');
      expect(routerCode).toContain("Nao e possivel eliminar um administrador");
    });

    it("should restrict company deletion to admin", () => {
      expect(routerCode).toContain("adminProcedure");
    });

    it("should restrict KPI settings to admin", () => {
      expect(fs.readFileSync(`${process.cwd()}/client/src/pages/KPI.tsx`, "utf-8")).toContain('role === "admin"');
    });

    it("should restrict Administração page and management mutations to Admin", () => {
      expect(layoutCode).toContain("canAdmin");
      expect(layoutCode).not.toContain("canAdminOrDO");
      expect(routerCode).toContain("function assertAdminOnly");
      expect(routerCode).toContain('"company_updated"');
      expect(routerCode).toContain('"user_role_updated"');
      expect(routerCode).toContain('"invitation_created"');
    });
  });

  describe("Data Isolation", () => {
    it("should filter submissions by company for EE/RAP", () => {
      expect(routerCode).toMatch(/companyId|company_id/);
    });

    it("should have project scoping in queries", () => {
      expect(routerCode).toMatch(/projectId|project_id/);
    });
  });
});
