import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const handover = resolve(root, "handover/database-fresh-start");
const source = (file: string) => readFileSync(resolve(handover, file), "utf8");

describe("pacote de fresh start para IT", () => {
  it("entrega uma baseline íntegra, sem dados nem comandos destrutivos", () => {
    const sql = source("drizzle/0000_stand_schema_baseline.sql");
    const expectedHash = source("SCHEMA_BASELINE_SHA256.txt").trim().split(/\s+/)[0];
    const hash = createHash("sha256").update(sql).digest("hex");
    expect(hash).toBe(expectedHash);
    expect((sql.match(/^CREATE TABLE /gim) ?? []).length).toBe(59);
    expect(sql).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|TRUNCATE|CREATE\s+USER|GRANT|REVOKE)\b/im);
  });

  it("tem utilitários separados para o primeiro administrador e catálogo sem dados de obra", () => {
    const catalogue = JSON.parse(source("catalogue-template-SIN02.json"));
    expect(catalogue.format).toBe("stand-catalogue-template/v1");
    expect(catalogue.project.code).toBe("SIN02");
    expect(catalogue.sections).toHaveLength(28);
    expect(catalogue.measures).toHaveLength(317);
    expect(catalogue.measures.filter((item: any) => item.catalogueScope === "weekly")).toHaveLength(156);
    expect(catalogue.measures.filter((item: any) => item.catalogueScope === "dcape")).toHaveLength(161);
    expect(source("bootstrap-initial-admin.mjs")).toContain("stdin.isTTY");
    expect(source("bootstrap-initial-admin.mjs")).not.toContain("process.argv[2]");
  });

  it("passa o validador executável entregue ao IT", () => {
    const result = spawnSync("node", [resolve(handover, "validate-baseline.mjs")], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Baseline válida: 59 tabelas");
  });
});
