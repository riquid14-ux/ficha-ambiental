import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("MIRR — confirmação de eliminação de e-GAR", () => {
  it("usa um diálogo acessível e atualiza também o Waste Map após eliminar", () => {
    const source = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/MIRR.tsx"), "utf8");
    expect(source).toContain("AlertDialogTitle>Eliminar e-GAR?");
    expect(source).toContain("setEgarPendingDelete({ id: e.id");
    expect(source).toContain("wasteMapQuery.refetch()");
    expect(source).not.toContain("if (confirm(");
  });
});
