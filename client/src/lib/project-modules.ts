export const DEFAULT_PROJECT_MODULES = ["dashboard", "calendar", "timeline", "ficha", "residuos", "kpi"] as const;

const routeModule: Record<string, string> = {
  "/dashboard": "dashboard",
  "/calendario": "calendar",
  "/timeline": "timeline",
  "/ficha": "ficha",
  "/residuos": "residuos",
  "/kpi": "kpi",
};

export function parseProjectModules(raw?: string | null): string[] {
  if (!raw) return [...DEFAULT_PROJECT_MODULES];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(item => typeof item === "string")
      ? parsed
      : [...DEFAULT_PROJECT_MODULES];
  } catch {
    return [...DEFAULT_PROJECT_MODULES];
  }
}

export function isProjectRouteEnabled(rawModules: string | null | undefined, path: string) {
  const module = routeModule[path];
  return !module || parseProjectModules(rawModules).includes(module);
}
