import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RDCD_BRAND_PROFILES, buildRdcdWeeklyRows } from "../client/src/lib/rdcd-template";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const routerSource = read("server/routers.ts");
const schemaSource = read("drizzle/schema.ts");
const migrationSource = read("drizzle/0062_rdcd_reports.sql");
const pageSource = read("client/src/pages/RDCD.tsx");
const storageAuthorizationSource = read("server/storage-authorization.ts");
const rdcdMediaSource = read("server/rdcd-media.ts");

describe("RDCD — relatório estruturado e rastreável", () => {
  it("mantém o rascunho editorial separado de ficheiros e fontes de origem", () => {
    const reportTable = schemaSource.slice(schemaSource.indexOf("export const rdcdReports"), schemaSource.indexOf("// Audit log"));
    expect(reportTable).toContain('mysqlTable("rdcd_reports"');
    expect(reportTable).toContain("contentJson");
    expect(reportTable).toContain("selectionJson");
    expect(reportTable).toContain("planIdsJson");
    expect(reportTable).not.toContain("fileKey");
    expect(reportTable).not.toContain("fileUrl");
  });

  it("cria uma migração não destrutiva para o rascunho RDCD", () => {
    expect(migrationSource).toContain("CREATE TABLE `rdcd_reports`");
    expect(migrationSource).toContain("rdcd_reports_project_period_idx");
    expect(migrationSource).not.toMatch(/DROP\s+TABLE|DELETE\s+FROM|TRUNCATE/i);
  });

  it("restringe rascunhos e e-GAR do RDCD a utilizadores autorizados e ao projeto", () => {
    const rdcdStart = routerSource.indexOf("  rdcd: router({");
    const rdcdRouter = routerSource.slice(rdcdStart, routerSource.indexOf("  // Audit log", rdcdStart));
    expect(rdcdRouter).toContain('if (!isAdminOrDono(ctx.user.role))');
    expect((rdcdRouter.match(/assertProjectAccess\(ctx\.user, input\.projectId\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(rdcdRouter).toContain("await db.getWasteEgars(input.projectId)");
    expect(rdcdRouter).toContain("Number(egar.date) >= input.startAt");
    expect(rdcdRouter).toContain("Number(egar.date) <= input.endAt");
    expect(rdcdRouter).toContain("correctedQuantity || egar.quantity");
  });

  it("oferece perfis institucionais configuráveis do template sem os tornar públicos", () => {
    expect(Object.keys(RDCD_BRAND_PROFILES)).toEqual([
      "startcampus_gleeds_quadrante",
      "startcampus_gleeds",
      "startcampus",
    ]);
    expect(RDCD_BRAND_PROFILES.startcampus_gleeds_quadrante.logos).toHaveLength(3);
    for (const profile of Object.values(RDCD_BRAND_PROFILES)) {
      for (const logo of profile.logos) expect(logo.url).toMatch(/^\/manus-storage\//);
    }
    expect(storageAuthorizationSource).toContain('"start-campus-rdcd_d271a631.png"');
    expect(storageAuthorizationSource).toContain('key.match(/^rdcd-branding');
    expect(rdcdMediaSource).toContain('app.get("/api/rdcd/media/logo"');
    expect(rdcdMediaSource).toContain("user.role !== \"admin\" && user.role !== \"dono_obra\"");
  });

  it("preserva a seleção individual de semanas por medida na compilação", () => {
    const rows = buildRdcdWeeklyRows([
      { id: 10, weekNumber: 22, weekYear: 2026, weekStartDate: "2026-05-25", weekEndDate: "2026-05-31" },
      { id: 11, weekNumber: 26, weekYear: 2026, weekStartDate: "2026-06-22", weekEndDate: "2026-06-28" },
    ], [
      { submissionId: 10, measureId: 1, status: "C", observations: "Primeira observação" },
      { submissionId: 11, measureId: 2, status: "I", observations: "Segunda observação" },
    ], [
      { id: 1, number: "1", sectionId: 1, description: "Medida um" },
      { id: 2, number: "2", sectionId: 1, description: "Medida dois" },
    ], [{ id: 1, name: "Construção" }], "Execução da obra");
    expect(rows.map(row => row.week)).toEqual([22, 26]);
    expect(rows[0].reference).toBe("ID 10");
    expect(rows[1].reference).toBe("ID 11");
    expect(rows.every(row => row.phases === "Execução da obra")).toBe(true);
  });

  it("gera o Word a partir de semanas, fotografias e e-GAR selecionados pelo responsável", () => {
    expect(pageSource).toContain("selectedImageUrls");
    expect(pageSource).toContain("selectedWeeks");
    expect(pageSource).toContain("trpc.rdcd.save.useMutation");
    expect(pageSource).toContain("trpc.rdcd.wasteRows.useQuery");
    expect(pageSource).toContain("Anexo III — Registo de Resíduos e-GAR do Período");
    expect(pageSource).toContain("A geração não aprova, assina nem arquiva o relatório");
    expect(pageSource).toContain("RELATÓRIO DE DEMONSTRAÇÃO");
    expect(pageSource).toContain("ÍNDICE GERAL");
    expect(pageSource).toContain("chapterDetails");
    expect(pageSource).toContain("Ações, responsabilidades e prazos");
    expect(pageSource).toContain("uploadLogoMutation");
    expect(pageSource).toContain("reportLogos");
    expect(pageSource).toContain("/api/rdcd/media/logo?projectId=");
  });
});
