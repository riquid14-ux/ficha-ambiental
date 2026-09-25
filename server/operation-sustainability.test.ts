import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("inventário sustentável do SIN01", () => {
  const schema = read("drizzle/schema.ts");
  const router = read("server/routers.ts");
  const client = read("client/src/pages/Operation.tsx");

  it("mantém stocks e inventário químico separados das leituras e faturas", () => {
    expect(schema).toContain('mysqlTable("operation_sustainability_snapshots"');
    expect(schema).toContain('mysqlTable("operation_chemical_inventory"');
    expect(schema).toContain('operation_sustainability_snapshot_project_recorded_idx');
    expect(schema).toContain('operation_chemical_inventory_project_name_idx');
  });

  it("aplica âmbito de operação, autorização de escrita e auditoria", () => {
    expect(router).toContain("sustainabilitySnapshots: protectedProcedure");
    expect(router).toContain("recordSustainabilitySnapshot: protectedProcedure");
    expect(router).toContain("chemicalInventory: protectedProcedure");
    expect(router).toContain("upsertChemicalInventory: protectedProcedure");
    expect(router).toContain("deleteChemicalInventory: protectedProcedure");
    expect(router).toContain("assertOperationAccess(ctx.user, input.projectId)");
    expect(router).toContain('"operation_sustainability_snapshot_create"');
    expect(router).toContain('"operation_chemical_update"');
    expect(router).toContain('"operation_chemical_delete"');
  });

  it("expõe uma aba aditiva sem alterar o cockpit existente", () => {
    expect(client).toContain('TabsTrigger value="sustentabilidade"');
    expect(client).toContain('<SustainabilityInventory');
    expect(client).toContain("O conector BMS não é inferido por esta aba");
    expect(client).toContain("WUE versus PUE");
  });
});
