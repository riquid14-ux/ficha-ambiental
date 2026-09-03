import { isProjectRouteEnabled } from "@/lib/project-modules";

type NavigationInput = {
  role: string;
  isAllProjects: boolean;
  isOperationOnly: boolean;
  enabledModules?: string | null;
  partnerAccess?: { allowWaste?: boolean; allowKpi?: boolean } | null;
};

const GLOBAL_ROUTES = ["/welcome", "/dashboard", "/planos", "/calendario", "/timeline", "/rdcd", "/gamma"];
const OPERATION_ROUTES = ["/welcome", "/dashboard", "/calendario", "/mirr", "/fases", "/certificacoes"];
const STANDARD_PROJECT_MENU_ROUTES = ["/welcome", "/dashboard", "/calendario", "/timeline", "/ficha", "/residuos", "/kpi"];
const PROJECT_ROLE_ROUTES: Record<string, string[]> = {
  admin: ["/welcome", "/dashboard", "/calendario", "/timeline", "/ficha", "/residuos", "/kpi"],
  dono_obra: ["/welcome", "/dashboard", "/calendario", "/timeline", "/ficha", "/residuos", "/kpi"],
  pm: ["/welcome", "/dashboard", "/calendario", "/timeline", "/ficha", "/residuos", "/kpi"],
  ee: ["/welcome", "/ficha", "/residuos", "/kpi", "/dashboard-parceiros", "/pedidos-eep"],
  raa: ["/welcome", "/ficha", "/residuos", "/kpi"],
  rap: ["/welcome", "/ficha", "/kpi"],
  observador: ["/welcome", "/dashboard", "/ficha"],
  user: ["/welcome", "/ficha"],
};

export function getVisibleNavigationPaths(input: NavigationInput) {
  const { role, isAllProjects, isOperationOnly, enabledModules, partnerAccess } = input;
  if (isAllProjects) return ["admin", "dono_obra"].includes(role) ? GLOBAL_ROUTES : [];
  if (role === "ee_partner") {
    return [
      ...(partnerAccess?.allowWaste ? ["/residuos"] : []),
      ...(partnerAccess?.allowKpi ? ["/kpi"] : []),
    ];
  }
  const permitted = PROJECT_ROLE_ROUTES[role] || PROJECT_ROLE_ROUTES.user;
  if (isOperationOnly) return OPERATION_ROUTES.filter(path => isProjectRouteEnabled(enabledModules, path));
  return STANDARD_PROJECT_MENU_ROUTES
    .filter(path => permitted.includes(path) && isProjectRouteEnabled(enabledModules, path))
    .concat(permitted.filter(path => ["/dashboard-parceiros", "/pedidos-eep"].includes(path)));
}
