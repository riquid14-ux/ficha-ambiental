import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCompanyRelationshipNetwork } from "../client/src/lib/company-relationship-network";

describe("mapa de empresas por projecto", () => {
  const companies = [
    { id: 1, name: "Start Campus", shortName: "SC", companyType: "dono_obra", active: 1 },
    { id: 2, name: "TSL", shortName: "GC1", companyType: "ee", active: 1 },
    { id: 3, name: "Conduril", shortName: "CON", companyType: "ee_partner", parentCompanyId: 2, allowKpi: true, allowWaste: true, active: 1 },
    { id: 4, name: "Mels", shortName: "MLS", companyType: "ee_partner", parentCompanyId: 2, allowKpi: true, allowWaste: false, active: 1 },
    { id: 5, name: "Entidade externa", shortName: "EXT", companyType: "ee", active: 1 },
  ];

  it("mostra apenas empresas do projecto e aninha EEP sob a respectiva EE", () => {
    const network = buildCompanyRelationshipNetwork(companies, [
      { projectId: 101, companyId: 1 }, { projectId: 101, companyId: 2 }, { projectId: 101, companyId: 3 }, { projectId: 101, companyId: 4 },
      { projectId: 102, companyId: 5 },
    ], 101);

    expect(network.assigned.map(company => company.id)).toEqual([1, 2, 3, 4]);
    expect(network.principals.map(company => company.shortName)).toEqual(["GC1"]);
    expect(network.partnersByParent.get(2)?.map(company => company.shortName)).toEqual(["CON", "MLS"]);
    expect(network.orphanPartners).toEqual([]);
  });

  it("sinaliza EEP associada a um projecto sem a respectiva EE principal", () => {
    const network = buildCompanyRelationshipNetwork(companies, [{ projectId: 101, companyId: 3 }], 101);
    expect(network.principals).toEqual([]);
    expect(network.orphanPartners.map(company => company.shortName)).toEqual(["CON"]);
  });

  it("só monta a hierarquia da Administração no projecto individual activo", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
    expect(source).toContain("!isAllProjects && activeProject");
    expect(source).toContain("activeProjectId={activeProject.id}");
  });

  it("apresenta entidades PM como PM e não como Observador", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/CompanyRelationshipMap.tsx"), "utf8");
    expect(source).toContain('if (companyType === "pm") return "PM";');
  });
});
