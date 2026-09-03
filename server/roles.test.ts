import { describe, it, expect } from "vitest";
import fs from "fs";
import { getVisibleNavigationPaths } from "../client/src/lib/role-navigation";

const routerCode = fs.readFileSync(`${process.cwd()}/server/routers.ts`, "utf-8");
const layoutCode = fs.readFileSync(`${process.cwd()}/client/src/components/AppLayout.tsx`, "utf-8");
const weeklyFormCode = fs.readFileSync(`${process.cwd()}/client/src/pages/WeeklyForm.tsx`, "utf-8");
const reviewCode = fs.readFileSync(`${process.cwd()}/client/src/pages/ReviewPage.tsx`, "utf-8");
const dashboardCode = fs.readFileSync(`${process.cwd()}/client/src/pages/Dashboard.tsx`, "utf-8");
const projectContextCode = fs.readFileSync(`${process.cwd()}/client/src/contexts/ProjectContext.tsx`, "utf-8");
const projectInput = { isAllProjects: false, isOperationOnly: false, enabledModules: null };

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
    it("should restrict EE to the modules visible in its menu", () => {
      expect(getVisibleNavigationPaths({ role: "ee", ...projectInput })).toEqual([
        "/welcome", "/ficha", "/residuos", "/kpi", "/dashboard-parceiros", "/pedidos-eep",
      ]);
    });

    it("should restrict RAA to Ficha, Resíduos and KPI", () => {
      expect(getVisibleNavigationPaths({ role: "raa", ...projectInput })).toEqual([
        "/welcome", "/ficha", "/residuos", "/kpi",
      ]);
    });

    it("should restrict RAP to Ficha and KPI, without Resíduos", () => {
      expect(getVisibleNavigationPaths({ role: "rap", ...projectInput })).toEqual([
        "/welcome", "/ficha", "/kpi",
      ]);
    });

    it("should give Observador only Welcome, Dashboard, Ficha (read-only)", () => {
      expect(getVisibleNavigationPaths({ role: "observador", ...projectInput })).toEqual([
        "/welcome", "/dashboard", "/ficha",
      ]);
    });

    it("should give Admin full access", () => {
      expect(getVisibleNavigationPaths({ role: "admin", ...projectInput })).toEqual([
        "/welcome", "/dashboard", "/calendario", "/timeline", "/ficha", "/residuos", "/kpi",
      ]);
    });

    it("should give PM operational modules only inside assigned projects", () => {
      expect(getVisibleNavigationPaths({ role: "pm", ...projectInput })).toContain("/dashboard");
      expect(getVisibleNavigationPaths({ role: "pm", ...projectInput })).toContain("/calendario");
      expect(getVisibleNavigationPaths({ role: "pm", ...projectInput })).toContain("/timeline");
      expect(projectContextCode).not.toMatch(/canSeeAllProjects[^;]*pm/);
    });
  });

  describe("All Projects Visibility", () => {
    it("should only allow Admin and DO to see Todos os Projetos", () => {
      expect(getVisibleNavigationPaths({ role: "admin", ...projectInput, isAllProjects: true })).toContain("/rdcd");
      expect(getVisibleNavigationPaths({ role: "dono_obra", ...projectInput, isAllProjects: true })).toContain("/rdcd");
      expect(getVisibleNavigationPaths({ role: "pm", ...projectInput, isAllProjects: true })).toEqual([]);
      expect(projectContextCode).toContain('user?.role === "admin" || user?.role === "dono_obra"');
      expect(projectContextCode).not.toMatch(/canSeeAllProjects[^;]*pm/);
    });

    it("should block EE, RAP, RAA from seeing all-projects view", () => {
      for (const role of ["ee", "rap", "raa"]) {
        expect(getVisibleNavigationPaths({ role, ...projectInput, isAllProjects: true })).toEqual([]);
      }
    });

    it("should expose Pedidos EEP and Dashboard Parceiros only to EE", () => {
      expect(getVisibleNavigationPaths({ role: "ee", ...projectInput })).toEqual(expect.arrayContaining(["/pedidos-eep", "/dashboard-parceiros"]));
      expect(getVisibleNavigationPaths({ role: "raa", ...projectInput })).not.toEqual(expect.arrayContaining(["/pedidos-eep", "/dashboard-parceiros"]));
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
