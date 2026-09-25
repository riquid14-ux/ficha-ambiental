import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("guardas de tradução PT/EN", () => {
  it("emite avisos deduplicados apenas em desenvolvimento para lacunas de tradução", () => {
    const source = read("client/src/contexts/LanguageContext.tsx");
    expect(source).toContain("const warnedTranslationGaps = new Set<string>()");
    expect(source).toContain("if (!import.meta.env.DEV) return;");
    expect(source).toContain('warnTranslationGap("missing-key", language, key)');
    expect(source).toContain('warnTranslationGap("missing-language", language, key)');
  });

  it("mantém uma auditoria AST de literais JSX para acompanhar a migração", () => {
    const script = read("scripts/audit-i18n-literals.mjs");
    expect(script).toContain("ts.createSourceFile");
    expect(script).toContain("isJsxText");
    expect(script).toContain("PORTUGUESE_MARKERS");
  });

  it("localiza os novos rótulos de navegação e galeria", () => {
    const source = read("client/src/contexts/LanguageContext.tsx");
    expect(source).toContain('"Desempenho e Monitorização Ambiental": { pt: "Desempenho e Monitorização Ambiental", en: "Performance & Environmental Monitoring" }');
    expect(source).toContain('"Categoria fotográfica": { pt: "Categoria fotográfica", en: "Photo category" }');
  });
});
