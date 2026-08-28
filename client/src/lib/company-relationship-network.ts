export type CompanyNetworkCompany = {
  id: number;
  name: string;
  shortName: string;
  companyType: string;
  active: number | boolean;
  parentCompanyId?: number | null;
  allowKpi?: boolean;
  allowWaste?: boolean;
};

export type CompanyNetworkAssignment = {
  companyId: number;
  projectId: number;
};

/** Agrupa exclusivamente as entidades atribuídas ao projecto seleccionado. */
export function buildCompanyRelationshipNetwork(
  companies: CompanyNetworkCompany[],
  assignments: CompanyNetworkAssignment[],
  projectId: number,
) {
  const assignedIds = new Set(assignments.filter(item => item.projectId === projectId).map(item => item.companyId));
  const assigned = companies.filter(company => assignedIds.has(company.id));
  const assignedById = new Map(assigned.map(company => [company.id, company]));
  const principals = assigned.filter(company => company.companyType === "ee" || company.companyType === "rap");
  const partnersByParent = new Map<number, CompanyNetworkCompany[]>();
  const orphanPartners: CompanyNetworkCompany[] = [];

  for (const partner of assigned.filter(company => company.companyType === "ee_partner")) {
    if (partner.parentCompanyId && assignedById.has(partner.parentCompanyId)) {
      const current = partnersByParent.get(partner.parentCompanyId) || [];
      partnersByParent.set(partner.parentCompanyId, [...current, partner]);
    } else {
      orphanPartners.push(partner);
    }
  }

  return {
    assigned,
    owners: assigned.filter(company => company.companyType === "dono_obra"),
    principals,
    partnersByParent,
    orphanPartners,
    otherEntities: assigned.filter(company => !["dono_obra", "ee", "rap", "ee_partner"].includes(company.companyType)),
  };
}
