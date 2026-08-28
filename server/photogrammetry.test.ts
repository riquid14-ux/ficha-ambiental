import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { MapPhoto } from "../drizzle/schema";
import { validatePhotogrammetryBatch } from "./photogrammetry";
import { UnconfiguredPhotogrammetryWorker } from "./photogrammetry-worker";

const root = resolve(import.meta.dirname, "..");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migrationSource = readFileSync(resolve(root, "drizzle/0029_adorable_chat.sql"), "utf8");
const readyMigrationSource = readFileSync(resolve(root, "drizzle/0030_crazy_morph.sql"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const pageSource = readFileSync(resolve(root, "client/src/pages/ProjectMap.tsx"), "utf8");
const canvasSource = readFileSync(resolve(root, "client/src/components/ProjectMapCanvas.tsx"), "utf8");
const workerSource = readFileSync(resolve(root, "server/photogrammetry.ts"), "utf8");

function photo(id: number, options: { gps?: boolean; pitch?: number; yaw?: number } = {}): MapPhoto {
  const gps = options.gps ?? true;
  return {
    id,
    surveyId: 10,
    projectId: 2,
    fileKey: `map/test-${id}.jpg`,
    fileUrl: `https://storage.invalid/test-${id}.jpg`,
    filename: `DJI_${id}.JPG`,
    mimeType: "image/jpeg",
    latitude: gps ? String(37.95 + id * 0.0001) : null,
    longitude: gps ? String(-8.87 + id * 0.0001) : null,
    relativeAltitudeM: "90",
    imageWidth: 4000,
    imageHeight: 3000,
    metadataJson: JSON.stringify({ gimbalPitchDegree: options.pitch ?? -90, gimbalYawDegree: options.yaw ?? 35, relativeAltitudeM: 90 }),
    capturedAt: Date.now(),
    createdBy: 1,
    createdAt: new Date(),
  };
}

describe("Fotogrametria DJI — validação e isolamento", () => {
  it("adiciona jobs e outputs por referência sem BLOBs nem operações destrutivas", () => {
    expect(schemaSource).toContain('mysqlTable("photogrammetry_jobs"');
    for (const field of ["orthophotoFileKey", "tilesBaseKey", "dsmFileKey", "reportFileKey", "reprojectionErrorPx"]) expect(schemaSource).toContain(`${field}:`);
    expect(schemaSource).not.toMatch(/photogrammetryJobs[\s\S]{0,2500}\b(blob|binary|mediumblob|longblob)\s*\(/i);
    expect(migrationSource).not.toMatch(/\b(DROP|TRUNCATE|DELETE|RENAME)\b/i);
    expect(readyMigrationSource).toContain("'ready'");
  });

  it("aceita apenas um lote georreferenciado com fotografias verticais a 90°", () => {
    const result = validatePhotogrammetryBatch([
      photo(1), photo(2), photo(3), photo(4), photo(5),
    ]);
    expect(result.accepted).toBe(true);
    expect(result.geolocatedCount).toBe(5);
    expect(result.nadirCount).toBe(5);
    expect(result.obliqueCount).toBe(0);
    expect(result.geographicBounds).not.toBeNull();
  });

  it("rejeita um lote que contenha fotografias oblíquas ou sem orientação vertical verificável", () => {
    const oblique = validatePhotogrammetryBatch([photo(1), photo(2), photo(3), photo(4), photo(5, { pitch: -60 })]);
    expect(oblique.accepted).toBe(false);
    expect(oblique.issues.map(issue => issue.code)).toContain("NADIR_90_REQUIRED");
    expect(oblique.obliqueCount).toBe(1);

    const noPitch = photo(6);
    noPitch.metadataJson = JSON.stringify({ gimbalYawDegree: 35, relativeAltitudeM: 90 });
    const missingOrientation = validatePhotogrammetryBatch([photo(1), photo(2), photo(3), photo(4), noPitch]);
    expect(missingOrientation.accepted).toBe(false);
    expect(missingOrientation.issues.map(issue => issue.code)).toContain("NADIR_90_REQUIRED");
  });

  it("rejeita lotes demasiado pequenos ou com menos de 80% de GPS", () => {
    expect(validatePhotogrammetryBatch([photo(1), photo(2), photo(3), photo(4)]).accepted).toBe(false);
    const poorGps = [photo(1), photo(2), photo(3), photo(4, { gps: false }), photo(5, { gps: false })];
    const result = validatePhotogrammetryBatch(poorGps);
    expect(result.accepted).toBe(false);
    expect(result.issues.map(issue => issue.code)).toContain("INSUFFICIENT_GEOLOCATION");
  });

  it("não afirma sobreposição ou precisão antes do matching no worker", () => {
    const result = validatePhotogrammetryBatch([photo(1), photo(2), photo(3), photo(4), photo(5)]);
    expect(result.issues.map(issue => issue.code)).toContain("WORKER_OVERLAP_REQUIRED");
    expect(result.issues.some(issue => /matching.*worker/i.test(issue.message))).toBe(true);
  });

  it("mantém o worker desligado e incapaz de executar dentro da aplicação", async () => {
    const worker = new UnconfiguredPhotogrammetryWorker();
    await expect(worker.health()).resolves.toMatchObject({ healthy: false });
    await expect(worker.start()).rejects.toThrow("ainda não configurado");
  });

  it("expõe estados e controlos sem simular o início quando não há worker", () => {
    expect(routerSource).toContain("validatePhotogrammetryBatch");
    expect(routerSource).toContain("fotografias DJI verticais a 90°");
    expect(workerSource).toContain("NADIR_90_REQUIRED");
    expect(routerSource).toContain("if (!worker.configured || !worker.healthy)");
    expect(routerSource).toContain("return { started: false, job, worker }");
    expect(pageSource).toContain("Pronto para processar");
    expect(pageSource).toContain("Processar ortomosaico");
    expect(pageSource).toContain("Adicionar fotografias a 90°");
    expect(pageSource).toContain("worker?.message");
    expect(workerSource).toContain("Worker NodeODM privado ainda não configurado");
  });

  it("faz upload múltiplo incremental e mantém os outputs lazy-loaded", () => {
    expect(pageSource).toContain("multiple");
    expect(pageSource).toContain("uploadProgress.completed");
    expect(pageSource).toContain("for (let index = 0; index < accepted.length; index += 1)");
    expect(pageSource).toContain("Os tiles só são pedidos quando a camada for activada");
  });

  it("prepara uma timeline por data com enquadramento constante", () => {
    expect(pageSource).toContain("Evolução da obra");
    expect(pageSource).toContain("manter o mesmo enquadramento");
    expect(pageSource).toContain("capturedAt");
    expect(pageSource).toContain("Comparar com anterior");
    expect(pageSource).toContain("comparisonSurvey");
    expect(canvasSource).toContain("Limites do projecto");
    expect(canvasSource).toContain("Ortomosaico / comparação");
    expect(canvasSource).toContain("comparisonSurvey?.resultType");
    expect(canvasSource).toContain("comparisonSurvey.orthomosaicUrl");
    expect(canvasSource).not.toMatch(/google\.maps|openstreetmap|tile\.openstreetmap/i);
  });
});
