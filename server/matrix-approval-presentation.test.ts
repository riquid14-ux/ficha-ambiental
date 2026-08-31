import { describe, expect, it } from "vitest";
import { getMatrixStatusDisplay } from "../client/src/lib/matrix-status";

describe("Matriz de Fichas Semanais — aprovação", () => {
  it("distingue submissão em revisão de ficha efectivamente aprovada", () => {
    expect(getMatrixStatusDisplay("submitted").label).toBe("Em Revisão");
    expect(getMatrixStatusDisplay("under_review").label).toBe("Em Revisão");
    expect(getMatrixStatusDisplay("approved")).toMatchObject({
      label: "Aprovada",
      color: "bg-emerald-500",
      description: "Ficha aprovada",
    });
  });
});
