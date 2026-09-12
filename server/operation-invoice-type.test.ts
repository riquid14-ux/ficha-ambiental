import { describe, expect, it } from "vitest";
import { buildOperationInvoicePayload, normalizeOperationInvoiceType, operationInvoiceLabel } from "../client/src/lib/operation-invoices";

describe("Operação — tipo de fatura manual", () => {
  it("converte os rótulos portugueses apresentados na interface nos códigos aceites pelo servidor", () => {
    expect(normalizeOperationInvoiceType("Eletricidade")).toBe("electricidade");
    expect(normalizeOperationInvoiceType("Água potável")).toBe("agua_potavel");
    expect(normalizeOperationInvoiceType("Gasóleo")).toBe("gasoleo");
    expect(normalizeOperationInvoiceType("tipo desconhecido")).toBeNull();
    expect(operationInvoiceLabel("electricidade")).toBe("Eletricidade");
    expect(buildOperationInvoicePayload({ projectId: 60001, invoiceType: "Eletricidade", quantity: 100, unit: "kWh" })).toMatchObject({ invoiceType: "electricidade", quantity: 100 });
  });
});
