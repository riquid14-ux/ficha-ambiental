import { describe, expect, it } from "vitest";
import { archiveWasteEgarIfRequired, isWithinWasteEgarDeletionWindow, shouldArchiveWasteEgar } from "./routers";

describe("Resíduos — arquivo QA", () => {
  it("não envia registos QA temporários para o arquivo externo", () => {
    expect(shouldArchiveWasteEgar("QA-TEMP-EGAR-20260911")).toBe(false);
    expect(shouldArchiveWasteEgar("EGAR-2026-001")).toBe(true);
    expect(shouldArchiveWasteEgar(undefined)).toBe(true);
  });

  it("reconhece estritamente a janela de 48 horas para eliminação pelo autor ou pela entidade", () => {
    const now = Date.parse("2026-09-12T12:00:00Z");
    expect(isWithinWasteEgarDeletionWindow("2026-09-10T12:00:00Z", now)).toBe(true);
    expect(isWithinWasteEgarDeletionWindow("2026-09-10T11:59:59Z", now)).toBe(false);
    expect(isWithinWasteEgarDeletionWindow("data inválida", now)).toBe(false);
  });

  it("não invoca o arquivo externo quando o fluxo recebe um identificador QA temporário", async () => {
    const archive = async () => { throw new Error("O arquivo não deve ser chamado para QA"); };
    await expect(archiveWasteEgarIfRequired("QA-TEMP-EGAR-20260912", archive)).resolves.toBe(false);
    let calls = 0;
    await expect(archiveWasteEgarIfRequired("EGAR-2026-001", async () => { calls += 1; })).resolves.toBe(true);
    expect(calls).toBe(1);
  });
});
