import { isProjectRouteEnabled } from "@/lib/project-modules";

type NavigationInput = {
  role: string;
  isAllProjects: boolean;
  isOperationOnly: boolean;
  enabledModules?: string | null;
  pmAccessModules?: string | null;
  partnerAccess?: { allowWaste?: boolean; allowKpi?: boolean } | null;
};

const GLOBAL_ROUTES = ["/welcome", "/dashboard", "/planos", "/calendario", "/timeline", "/rdcd", "/gamma"];
const OPERATION_ROUTES = ["/welcome", "/dashboard", "/operacao", "/planos", "/calendario", "/mirr", "/fases", "/certificacoes", "/documentacao"];
const STANDARD_PROJECT_MENU_ROUTES = ["/welcome", "/dashboard", "/planos", "/calendario", "/timeline", "/ficha", "/residuos", "/kpi", "/documentacao"];
const OPERATION_ROLE_ROUTES: Record<string, string[]> = {
  admin: OPERATION_ROUTES,
  dono_obra: OPERATION_ROUTES,
  pm: OPERATION_ROUTES,
  ee: ["/welcome", "/documentacao"],
  raa: ["/welcome", "/documentacao"],
};
const PROJECT_ROLE_ROUTES: Record<string, string[]> = {
  admin: ["/welcome", "/dashboard", "/planos", "/calendario", "/timeline", "/ficha", "/residuos", "/kpi", "/documentacao"],
  dono_obra: ["/welcome", "/dashboard", "/planos", "/calendario", "/timeline", "/ficha", "/residuos", "/kpi", "/documentacao"],
  pm: ["/welcome", "/dashboard", "/planos", "/calendario", "/timeline", "/ficha", "/residuos", "/kpi", "/documentacao"],
  ee: ["/welcome", "/ficha", "/residuos", "/kpi", "/dashboard-parceiros", "/pedidos-eep", "/documentacao"],
  raa: ["/welcome", "/planos", "/ficha", "/residuos", "/kpi", "/documentacao"],
  rap: ["/welcome", "/ficha", "/kpi"],
  observador: ["/welcome", "/dashboard", "/ficha"],
  user: ["/welcome", "/ficha"],
};

const PM_MODULE_ROUTES: Record<string, string> = {
  "/dashboard": "dashboard",
  "/planos": "planos",
  "/calendario": "calendar",
  "/timeline": "timeline",
  "/ficha": "ficha",
  "/residuos": "residuos",
  "/kpi": "kpi",
  "/operacao": "operacao",
  "/mirr": "residuos",
  "/fases": "timeline",
  "/documentacao": "documentacao",
};

const DEFAULT_PM_ACCESS_MODULES = Object.values(PM_MODULE_ROUTES);

function parsePmAccessModules(value?: string | null) {
  if (!value) return DEFAULT_PM_ACCESS_MODULES;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every(module => DEFAULT_PM_ACCESS_MODULES.includes(module))) return parsed as string[];
  } catch {
    // Configurações antigas mantêm acesso completo até serem configuradas na Administração.
  }
  return DEFAULT_PM_ACCESS_MODULES;
}

export function getVisibleNavigationPaths(input: NavigationInput) {
  const { role, isAllProjects, isOperationOnly, enabledModules, pmAccessModules, partnerAccess } = input;
  if (isAllProjects) return ["admin", "dono_obra"].includes(role) ? GLOBAL_ROUTES : [];
  if (role === "ee_partner") {
    return [
      ...(partnerAccess?.allowWaste ? ["/residuos"] : []),
      ...(partnerAccess?.allowKpi ? ["/kpi"] : []),
    ];
  }
  const permitted = role === "pm"
    ? (PROJECT_ROLE_ROUTES.pm || []).filter(path => path === "/welcome" || parsePmAccessModules(pmAccessModules).includes(PM_MODULE_ROUTES[path]))
    : (PROJECT_ROLE_ROUTES[role] || PROJECT_ROLE_ROUTES.user);
  if (isOperationOnly) {
    const permittedOperationRoutes = OPERATION_ROLE_ROUTES[role] || ["/welcome"];
    return OPERATION_ROUTES.filter(path => permittedOperationRoutes.includes(path) && isProjectRouteEnabled(enabledModules, path) && (role !== "pm" || path === "/welcome" || parsePmAccessModules(pmAccessModules).includes(PM_MODULE_ROUTES[path] || "dashboard")));
  }
  return STANDARD_PROJECT_MENU_ROUTES
    .filter(path => permitted.includes(path) && isProjectRouteEnabled(enabledModules, path))
    .concat(permitted.filter(path => ["/dashboard-parceiros", "/pedidos-eep"].includes(path)));
}
