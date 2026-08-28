import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("acesso RDCD", () => {
  const layout = readFileSync(resolve(process.cwd(), "client/src/components/AppLayout.tsx"), "utf8");
  const rdcd = readFileSync(resolve(process.cwd(), "client/src/pages/RDCD.tsx"), "utf8");

  it("mantém o RDCD exclusivamente no menu Todos os Projetos de Admin e Dono de Obra", () => {
    const allProjectsMenu = layout.slice(layout.indexOf("const allProjectsMenuItems"), layout.indexOf("const adminMenuItems"));
    const projectMenu = layout.slice(layout.indexOf("const projectMenuItems"), layout.indexOf("const operationProjectMenuItems"));
    expect(allProjectsMenu).toContain('{ icon: FileBarChart, label: "RDCD", path: "/rdcd" }');
    expect(projectMenu).not.toContain('label: "RDCD"');
    expect(layout).not.toContain('"/kpi", "/rdcd"]');
  });

  it("não anuncia acesso PM quando a consulta base de fichas não lhe é autorizada", () => {
    expect(rdcd).toContain('user?.role === "admin" || user?.role === "dono_obra"');
    expect(rdcd).not.toContain('user?.role === "pm"');
  });
});
