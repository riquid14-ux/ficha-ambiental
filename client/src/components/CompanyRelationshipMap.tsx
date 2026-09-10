import { useEffect, useMemo, useState } from "react";
import { Building2, GitBranch, Link2, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildCompanyRelationshipNetwork,
  type CompanyNetworkAssignment,
  type CompanyNetworkCompany,
} from "@/lib/company-relationship-network";

type ProjectOption = { id: number; code: string; name: string };

const typeLabel = (companyType: string) => {
  if (companyType === "ee") return "EE";
  if (companyType === "rap") return "RAP";
  if (companyType === "ee_partner") return "EEP";
  if (companyType === "dono_obra") return "Dono de Obra";
  if (companyType === "raa") return "RAA";
  if (companyType === "pm") return "PM";
  return "Observador";
};

function EntityNode({ company, compact = false }: { company: CompanyNetworkCompany; compact?: boolean }) {
  const isPartner = company.companyType === "ee_partner";
  const modules = [company.allowKpi && "KPI", company.allowWaste && "Resíduos"].filter(Boolean).join(" + ");
  return (
    <div className={`rounded-lg border bg-white ${isPartner ? "border-emerald-200" : "border-slate-200"} ${compact ? "p-2" : "p-3"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{company.shortName}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{company.name}</p>
        </div>
        <Badge variant={isPartner ? "secondary" : "outline"} className="shrink-0 text-[10px]">{typeLabel(company.companyType)}</Badge>
      </div>
      {isPartner && <p className="mt-2 text-[11px] text-emerald-800">{modules || "Módulos por configurar"}</p>}
      {!company.active && <p className="mt-2 text-[11px] font-medium text-amber-700">Inativa</p>}
    </div>
  );
}

export function CompanyRelationshipMap({
  companies,
  assignments,
  projects,
  activeProjectId,
}: {
  companies: CompanyNetworkCompany[];
  assignments: CompanyNetworkAssignment[];
  projects: ProjectOption[];
  activeProjectId?: number | null;
}) {
  const validProjects = projects.filter(project => project.code !== "main" && project.code !== "SIN01-NEST");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => activeProjectId ?? null);

  useEffect(() => {
    if (activeProjectId && validProjects.some(project => project.id === activeProjectId)) {
      if (selectedProjectId !== activeProjectId) setSelectedProjectId(activeProjectId);
      return;
    }
    if (selectedProjectId && validProjects.some(project => project.id === selectedProjectId)) return;
    setSelectedProjectId(validProjects[0]?.id ?? null);
  }, [activeProjectId, selectedProjectId, validProjects]);

  const selectedProject = validProjects.find(project => project.id === selectedProjectId) || null;
  const network = useMemo(() => selectedProjectId ? buildCompanyRelationshipNetwork(companies, assignments, selectedProjectId) : null, [companies, assignments, selectedProjectId]);

  return (
    <Card className="mt-6 border-slate-200">
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4 text-emerald-700" /> Mapa de empresas e ligações</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Veja, por projecto, as entidades atribuídas e a dependência explícita entre EE e EEP.</p>
        </div>
        <Select value={selectedProjectId ? String(selectedProjectId) : undefined} onValueChange={value => setSelectedProjectId(Number(value))}>
          <SelectTrigger className="w-full bg-white sm:w-[260px]"><SelectValue placeholder="Seleccione um projecto" /></SelectTrigger>
          <SelectContent>
            {validProjects.map(project => <SelectItem key={project.id} value={String(project.id)}>{project.code} — {project.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!selectedProject || !network ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Não existem projectos disponíveis para apresentar.</p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{selectedProject.code} — {selectedProject.name}</p>
              <Badge variant="outline" className="bg-white">{network.assigned.length} entidades atribuídas</Badge>
            </div>

            <div className="mx-auto max-w-md">
              {network.owners.length > 0 ? (
                <div className="space-y-2">
                  {network.owners.map(company => <EntityNode key={company.id} company={company} />)}
                  <div className="flex justify-center text-slate-400"><span className="h-5 border-l border-dashed border-slate-300" /></div>
                </div>
              ) : (
                <div className="mb-3 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" /> Dono de Obra não atribuído a este projecto</div>
              )}

              {network.principals.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {network.principals.map(principal => {
                    const partners = network.partnersByParent.get(principal.id) || [];
                    return (
                      <div key={principal.id} className="space-y-2">
                        <EntityNode company={principal} />
                        {partners.length > 0 && (
                          <div className="ml-4 border-l-2 border-emerald-200 pl-3">
                            <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-800"><Link2 className="h-3.5 w-3.5" /> EEPs subordinadas</div>
                            <div className="space-y-2">{partners.map(partner => <EntityNode key={partner.id} company={partner} compact />)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-600">Não existem EEs ou RAPs atribuídas a este projecto.</div>
              )}

              {network.orphanPartners.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">EEP com relação a validar</p>
                  <p className="mt-1">{network.orphanPartners.map(company => company.shortName).join(", ")} tem projecto atribuído, mas a EE principal não está associada a este mesmo projecto.</p>
                </div>
              )}
            </div>

            {network.otherEntities.length > 0 && (
              <div className="mt-5 border-t border-slate-200 pt-3">
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-700"><Users className="h-3.5 w-3.5" /> Outras entidades atribuídas</p>
                <div className="flex flex-wrap gap-2">{network.otherEntities.map(company => <EntityNode key={company.id} company={company} compact />)}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
