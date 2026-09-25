import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("galeria de evidências por fase", () => {
  const schema = read("drizzle/schema.ts");
  const router = read("server/routers.ts");
  const page = read("client/src/pages/PhaseMeasures.tsx");

  it("mantém a categoria opcional e não destrutiva no esquema", () => {
    expect(schema).toContain('category: varchar("category", { length: 120 })');
    expect(schema).toContain('referenceYear: int("referenceYear")');
  });

  it("valida que medida, evidência e projeto pertencem ao mesmo âmbito", () => {
    expect(router).toContain("db.getMeasureById(input.measureId, input.projectId)");
    expect(router).toContain("db.getPhaseEvidenceById(input.id)");
    expect(router).toContain('assertProjectModuleAccess(ctx.user, evidence.projectId, "timeline")');
  });

  it("mantém os controlos de segurança na receção de ficheiros", () => {
    expect(router).toContain("ALLOWED_FILE_TYPES.has(input.mimeType)");
    expect(router).toContain("sanitizeFile(buffer, input.mimeType, input.filename)");
    expect(router).toContain('category: input.category || null');
  });

  it("oferece galeria ampliada com navegação e categoria opcional", () => {
    expect(page).toContain('setSelectedPhotoIndex(index)');
    expect(page).toContain('max-h-[74vh]');
    expect(page).toContain('photo-category-${measure.id}');
    expect(page).toContain('onUploadFile(f, true, photoCategory.trim() || undefined)');
  });
});
