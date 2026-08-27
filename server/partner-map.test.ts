import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";
import {
  assessProjectionConfidence,
  boundsFromPoints,
  geoToPercent,
  metreSizeToPercent,
  parseGeoBounds,
} from "../client/src/lib/project-map-geometry";

const root = resolve(import.meta.dirname, "..");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migrationSource = readFileSync(resolve(root, "drizzle/0028_massive_pretty_boy.sql"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const trpcSource = readFileSync(resolve(root, "server/_core/trpc.ts"), "utf8");
const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");
const layoutSource = readFileSync(resolve(root, "client/src/components/AppLayout.tsx"), "utf8");
const adminSource = readFileSync(resolve(root, "client/src/pages/AdminPanel.tsx"), "utf8");
const kpiSource = readFileSync(resolve(root, "client/src/pages/KPI.tsx"), "utf8");
const wasteSource = readFileSync(resolve(root, "client/src/pages/MIRR.tsx"), "utf8");
const mapSource = readFileSync(resolve(root, "client/src/pages/ProjectMap.tsx"), "utf8");
const mapCanvasSource = readFileSync(resolve(root, "client/src/components/ProjectMapCanvas.tsx"), "utf8");
const welcomeSource = readFileSync(resolve(root, "client/src/pages/Welcome.tsx"), "utf8");
const sharedMapSource = readFileSync(resolve(root, "shared/project-map.ts"), "utf8");

function partnerContext(role: "admin" | "dono_obra" | "pm" | "ee_partner" | "observador" = "ee_partner") {
  return {
    user: {
      id: 780,
      openId: `test-${role}`,
      email: `${role}@example.com`,
      name: "Utilizador Teste",
      loginMethod: "password",
      role,
      companyId: 88,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: () => undefined },
  } as unknown as TrpcContext;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EEP — Entidade Executante Parceira — modelo e isolamento", () => {
  it("acrescenta o role e a configuração hierárquica sem migração destrutiva", () => {
    expect(schemaSource).toContain('"ee_partner"');
    expect(schemaSource).toContain('mysqlTable("partner_access_profiles"');
    for (const field of ["parentCompanyId", "allowKpi", "allowWaste", "active"]) expect(schemaSource).toContain(`${field}:`);
    expect(migrationSource).not.toMatch(/\b(DROP|TRUNCATE|DELETE|RENAME)\b/i);
  });

  it("bloqueia o parceiro por defeito nas rotas protegidas", async () => {
    expect(trpcSource).toContain('if (ctx.user.role === "ee_partner")');
    await expect(appRouter.createCaller(partnerContext()).audit.list({ limit: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("também bloqueia o parceiro no Mapa, mesmo que tente abrir a rota directamente", async () => {
    await expect(appRouter.createCaller(partnerContext()).projectMap.list({ projectId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permite apenas KPI, Resíduos e projectos através do procedimento explícito", () => {
    expect(routerSource).toContain("partnerAllowedProcedure");
    expect(routerSource).toContain("assertPartnerProjectModuleAccess");
    expect(layoutSource).toContain('partnerAccess?.allowWaste ? "/residuos" : null');
    expect(layoutSource).toContain('partnerAccess?.allowKpi ? "/kpi" : null');
    expect(layoutSource).toContain('userRole !== "ee_partner" && <NotificationBell />');
    expect(layoutSource).toContain("void logout().finally");
    expect(layoutSource).toContain('window.location.href = "/login"');
    expect(welcomeSource).toContain('enabled: userRole !== "ee_partner"');
  });

  it("valida a EE principal e limita projectos à intersecção autorizada", () => {
    const block = routerSource.slice(routerSource.indexOf("partners: router"), routerSource.indexOf("dashboard: router"));
    expect(block).toContain("A empresa principal deve ser uma EE");
    expect(block).toContain("parentProjectIds.has(projectId)");
    expect(block).toContain("db.setUserProjects(input.userId, input.projectIds)");
    expect(adminSource).toContain("Os projectos disponíveis são sempre limitados aos projectos da EE principal");
  });
});

describe("EEP — Entidade Executante Parceira — KPI e Resíduos", () => {
  it("guarda KPI parciais por empresa contributora sem sobrepor a EE ou outros parceiros", () => {
    expect(schemaSource).toContain('mysqlTable("kpi_submissions"');
    expect(schemaSource).toContain('mysqlEnum("sourceType", ["ee", "ee_partner"])');
    expect(schemaSource).toContain("kpi_submissions_contribution_unique");
    expect(routerSource).toContain('sourceType = "ee_partner"');
    expect(kpiSource).toContain("Submeter contributo parcial");
  });

  it("permite à EE principal ler a consolidação dos seus parceiros e mantém o parceiro isolado", () => {
    expect(dbSource).toContain("getPartnerAllowedProjectIds");
    expect(dbSource).toContain("filters?.networkCompanyId");
    expect(dbSource).toContain("eq(wasteEgars.parentCompanyId, filters.networkCompanyId)");
    expect(routerSource).toContain("getActivePartnerProfile");
    expect(kpiSource).toContain("A EE");
    expect(kpiSource).toContain("matriz consolidada");
    expect(kpiSource).toContain("A carregar submissões consolidadas");
    expect(kpiSource).toContain("matrixQuery.isLoading");
  });

  it("torna subprojectos de Resíduos persistentes e elimina o falso localStorage", () => {
    expect(schemaSource).toContain('mysqlTable("waste_subprojects"');
    expect(schemaSource).toContain("waste_subprojects_project_name_unique");
    expect(wasteSource).toContain("wasteEgars.subprojects.useQuery");
    expect(wasteSource).toContain("wasteEgars.createSubproject.useMutation");
    expect(wasteSource).not.toContain("mirr-subprojects-");
    expect(wasteSource).not.toContain("setSubProjects");
  });

  it("identifica subprojecto e entidade contributora na tabela e exportação", () => {
    expect(wasteSource).toContain("e.subProjectName");
    expect(wasteSource).toContain("e.companyName");
    expect(wasteSource).toContain("Entidade contributora");
    expect(routerSource).toContain("subProjectId: input.subProjectId ?? null");
  });
});

describe("Mapa privado — segurança e geometria", () => {
  it("usa um mapa base oficial predefinido e deixa o Admin ajustar apenas limites WGS84", () => {
    const mapRouter = routerSource.slice(routerSource.indexOf("projectMap: router"), routerSource.indexOf("feedback: router"));
    expect(sharedMapSource).toContain("DEFAULT_PROJECT_MAP");
    expect(sharedMapSource).toContain("Direção-Geral do Território — Ortofotos 2018");
    expect(sharedMapSource).toContain("CC BY 4.0");
    expect(sharedMapSource).toContain("/manus-storage/sines_dgt_ortos2018_332642c9.png");
    expect(mapRouter).toContain("effectiveProjectMapSetting");
    expect(mapRouter).toContain("updateBaseMapBounds");
    expect(mapRouter).toContain("boundsJson: JSON.stringify(input.bounds)");
    expect(mapSource).toContain("Ajustar limites");
    expect(mapSource).toContain("A plataforma fornece o mapa base oficial");
    expect(mapSource).not.toContain("Imagem raster");
    expect(mapSource).not.toContain("setBaseMapFile");
  });

  it("guarda fotografias em storage externo com sanitização e limites, sem obrigar o utilizador a fornecer o raster base", () => {
    const mapRouter = routerSource.slice(routerSource.indexOf("projectMap: router"), routerSource.indexOf("feedback: router"));
    expect(mapRouter).toContain("sanitizeFile(buffer");
    expect(mapRouter).toContain("storagePut(`project-maps/");
    expect(mapRouter).toContain("25 * 1024 * 1024");
    expect(mapRouter).toContain('await import("exifr")');
    expect(mapRouter).toContain("exif.GPSAltitude");
    expect(mapRouter).toContain("exif.GPSImgDirection");
    expect(mapRouter).not.toContain("uploadBaseMap:");
    expect(mapRouter).not.toContain("50 * 1024 * 1024");
  });

  it("limita a leitura do Mapa a Admin, Dono de Obra e PM e bloqueia Observador antes de consultar a base de dados", async () => {
    expect(sharedMapSource).toContain('MAP_READ_ROLES = ["admin", "dono_obra", "pm"]');
    expect(routerSource).toContain("assertMapReadRole(ctx.user.role)");
    expect(layoutSource).toContain('const canViewMap = ["admin", "dono_obra", "pm"].includes(userRole)');
    expect(layoutSource).toContain('item.path !== "/mapa" || canViewMap');
    expect(layoutSource).not.toContain('ee: ["/welcome", "/workflow", "/mapa"');
    await expect(appRouter.createCaller(partnerContext("observador")).projectMap.createSurvey({ projectId: 1, name: "Teste" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(partnerContext("observador")).projectMap.list({ projectId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permite escrita no Mapa apenas ao Admin", () => {
    const mapRouter = routerSource.slice(routerSource.indexOf("projectMap: router"), routerSource.indexOf("feedback: router"));
    expect(routerSource).toContain('if (role !== "admin")');
    expect(mapRouter).toContain("createSurvey: protectedProcedure");
    expect(mapRouter).toContain("updateBaseMapBounds: protectedProcedure");
    expect(mapSource).toContain('const canWrite = user?.role === "admin"');
    expect(mapSource).toContain("Novo levantamento");
  });

  it("prova em execução que Dono de Obra e PM lêem o Mapa mas não conseguem criar levantamentos", async () => {
    vi.spyOn(db, "getProjectById").mockResolvedValue({ id: 1, code: "SIN02", name: "SIN02" } as any);
    vi.spyOn(db, "getUserProjects").mockResolvedValue([{ projectId: 1 }] as any);
    vi.spyOn(db, "getProjectMapSetting").mockResolvedValue(undefined as any);
    vi.spyOn(db, "getMapSurveys").mockResolvedValue([] as any);

    for (const role of ["dono_obra", "pm"] as const) {
      const caller = appRouter.createCaller(partnerContext(role));
      const result = await caller.projectMap.list({ projectId: 1 });
      expect(result.setting?.sourceName).toContain("Direção-Geral do Território");
      await expect(caller.projectMap.createSurvey({ projectId: 1, name: `Teste ${role}` })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.projectMap.updateBaseMapBounds({ projectId: 1, bounds: { west: -8.885, south: 37.94, east: -8.855, north: 37.965 } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("calcula um buffer real de 200 m e converte coordenadas para a vista", () => {
    const bounds = boundsFromPoints([{ latitude: 37.93, longitude: -8.87 }, { latitude: 37.931, longitude: -8.869 }], 200)!;
    expect(bounds.south).toBeLessThan(37.93);
    expect(bounds.north).toBeGreaterThan(37.931);
    const position = geoToPercent({ latitude: 37.9305, longitude: -8.8695 }, bounds);
    expect(position.x).toBeGreaterThan(0);
    expect(position.x).toBeLessThan(100);
    expect(position.y).toBeGreaterThan(0);
    expect(position.y).toBeLessThan(100);
  });

  it("não trata imagens oblíquas ou sem metadados como camadas fiáveis", () => {
    expect(assessProjectionConfidence({}).renderAsOverlay).toBe(false);
    expect(assessProjectionConfidence({ relativeAltitudeM: 80, imageWidth: 4000, imageHeight: 3000, gimbalYawDegree: 5, gimbalPitchDegree: 35, focalLength35mm: 28 }).renderAsOverlay).toBe(false);
    expect(assessProjectionConfidence({ relativeAltitudeM: 80, imageWidth: 4000, imageHeight: 3000, gimbalYawDegree: 5, gimbalPitchDegree: -90, focalLength35mm: 28 }).level).toBe("high");
  });

  it("dimensiona a pegada no viewport sem ultrapassar valores inválidos", () => {
    const bounds = parseGeoBounds(JSON.stringify({ west: -8.88, south: 37.92, east: -8.86, north: 37.94 }))!;
    const size = metreSizeToPercent(120, 90, 37.93, bounds);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    expect(Number.isFinite(size.width)).toBe(true);
  });

  it("apresenta uma experiência map-first privada e distingue footprints de ortomosaico", () => {
    expect(mapSource).toContain("Ajustar limites do mapa base");
    expect(mapSource).toContain("Fotografias sem GPS não são forçadas para o mapa");
    expect(mapCanvasSource).toContain("Mapa privado");
    expect(mapCanvasSource).toContain("buffer 200 m");
    expect(mapCanvasSource).toContain('survey?.resultType === "orthomosaic"');
    expect(mapCanvasSource).not.toMatch(/google\.maps|openstreetmap|tile\.openstreetmap/i);
    expect(mapSource).toContain("Fotografias do levantamento");
    expect(mapSource).toContain("photo.relativeAltitudeM");
    expect(mapSource).toContain("metadata.gimbalYawDegree");
  });
});
