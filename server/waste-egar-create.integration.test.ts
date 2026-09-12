import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  archiveDocument: vi.fn().mockResolvedValue(undefined),
  createWasteEgar: vi.fn().mockResolvedValue({ id: 902001 }),
  getProjectById: vi.fn().mockResolvedValue({ id: 60001, code: "SIN01", enabledModules: JSON.stringify(["dashboard", "calendar", "timeline", "ficha", "residuos", "kpi", "operacao"]) }),
}));

vi.mock("./archive-provider", () => ({ archiveDocument: mocks.archiveDocument }));
vi.mock("./db", () => ({
  getProjectById: mocks.getProjectById,
  createWasteEgar: mocks.createWasteEgar,
}));

import { appRouter } from "./routers";

function caller() {
  return appRouter.createCaller({
    user: { id: 1, openId: "qa-admin", name: "QA Admin", email: "qa-admin@example.invalid", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} },
    res: {},
  } as unknown as TrpcContext);
}

function payload(egarId: string) {
  return { projectId: 60001, date: Date.parse("2026-09-12T12:00:00Z"), egarId, lerCode: "150101", designation: "Embalagens de papel e cartão", quantity: "0.001", month: 9, year: 2026 };
}

describe("Resíduos — integração de arquivo no create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("executa o procedimento real sem chamar archiveDocument para IDs QA temporários", async () => {
    const result = await caller().wasteEgars.create(payload("QA-TEMP-EGAR-INTEGRATION"));
    expect(mocks.createWasteEgar).toHaveBeenCalledOnce();
    expect(mocks.archiveDocument).not.toHaveBeenCalled();
    expect(result).toMatchObject({ archiveStatus: "excluido_qa" });
  });

  it("arquiva uma e-GAR operacional normal após a criação", async () => {
    const result = await caller().wasteEgars.create(payload("EGAR-2026-ARQUIVO"));
    expect(mocks.createWasteEgar).toHaveBeenCalledOnce();
    expect(mocks.archiveDocument).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ archiveStatus: "arquivado" });
  });
});
