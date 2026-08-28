import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Drill de risco da dependência ExcelJS", () => {
  it("resolve uuid 11.1.1 corrigido e não expõe as APIs v3/v5/v6 abrangidas pela CVE-2026-41907", () => {
    const store = path.join(process.cwd(), "node_modules/.pnpm");
    const excelDirectory = fs.readdirSync(store).find(entry => entry.startsWith("exceljs@4.4.0"));
    expect(excelDirectory).toBeTruthy();
    const excelPath = path.join(store, excelDirectory!, "node_modules/exceljs");
    const uuidPath = path.join(store, excelDirectory!, "node_modules/uuid");
    const uuidPackage = JSON.parse(fs.readFileSync(path.join(uuidPath, "package.json"), "utf-8"));
    expect(uuidPackage.version).toBe("11.1.1");
    const sources = [
      path.join(excelPath, "lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js"),
      path.join(excelPath, "dist/es5/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js"),
    ].map(file => fs.readFileSync(file, "utf-8")).join("\n");
    expect(sources).toMatch(/v4\s*:\s*uuidv4/);
    expect(sources).not.toMatch(/\bv3\s*:/);
    expect(sources).not.toMatch(/\bv5\s*:/);
    expect(sources).not.toMatch(/\bv6\s*:/);
  });
});
