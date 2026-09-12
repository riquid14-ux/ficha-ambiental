import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  archiveDocument: vi.fn().mockResolvedValue(undefined),
  createWasteEgar: vi.fn().mockResolvedValue({ id: 902001 }),
  getProjectById: vi.fn().mockResolvedValue({ id: 60001, code: "SIN01", enabledModules: JSON.stringify(["dashboard", "calendar", "timeline", "ficha", "residuos", "kpi", "operacao"]) }),
  getWasteEgarById: vi.fn(),
  getUserProjects: vi.fn().mockResolvedValue([]),
  getProjectsForCompany: vi.fn().mockResolvedValue([{ projectId: 60001 }]),
  deleteWasteEgar: vi.fn().mockResolvedValue(undefined),
  insertAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./archive-provider", () => ({ archiveDocument: mocks.archiveDocument }));
vi.mock("./db", () => ({
  getProjectById: mocks.getProjectById,
  createWasteEgar: mocks.createWasteEgar,
  getWasteEgarById: mocks.getWasteEgarById,
  getUserProjects: mocks.getUserProjects,
  getProjectsForCompany: mocks.getProjectsForCompany,
  deleteWasteEgar: mocks.deleteWasteEgar,
  insertAuditLog: mocks.insertAuditLog,
}));

import { appRouter } from "./routers";

function caller(role: "admin" | "ee" = "admin") {
  return appRouter.createCaller({
    user: { id: 1, openId: "qa-admin", name: "QA Admin", email: "qa-admin@example.invalid", loginMethod: "test", role, companyId: role === "ee" ? 77 : null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} },
    res: {},
  } as unknown as TrpcContext);
}

function payload(egarId: string) {
  return { projectId: 60001, date: Date.parse("2026-09-12T12:00:00Z"), egarId, lerCode: "150101", designation: "Embalagens de papel e cartão", quantity: "0.001", month: 9, year: 2026 };
}

describe("Resíduos — integração de arquivo no create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWasteEgarById.mockResolvedValue({ id: 902001, projectId: 60001, companyId: 77, createdBy: 1, egarId: "EGAR-2026-DELETE", lerCode: "150101", createdAt: new Date(Date.now() - 60 * 60 * 1000) });
  });

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

  it("elimina pelo procedimento real uma e-GAR da entidade dentro da janela de 48 horas e regista auditoria", async () => {
    await expect(caller("ee").wasteEgars.delete({ id: 902001 })).resolves.toEqual({ success: true });
    expect(mocks.deleteWasteEgar).toHaveBeenCalledWith(902001);
    expect(mocks.insertAuditLog).toHaveBeenCalledWith(1, "QA Admin", "waste_egar_delete", "waste_egars", 902001, expect.stringContaining("EGAR-2026-DELETE"), null);
  });

  it("recusa pelo procedimento real a eliminação da entidade após expirar a janela de 48 horas", async () => {
    mocks.getWasteEgarById.mockResolvedValueOnce({ id: 902001, projectId: 60001, companyId: 77, createdBy: 1, egarId: "EGAR-2026-EXPIRED", lerCode: "150101", createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) });
    await expect(caller("ee").wasteEgars.delete({ id: 902001 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.deleteWasteEgar).not.toHaveBeenCalled();
  });
});
