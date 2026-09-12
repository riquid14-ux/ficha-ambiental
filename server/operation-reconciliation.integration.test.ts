import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getProjectById: vi.fn().mockResolvedValue({ id: 60001, code: "SIN01", enabledModules: JSON.stringify(["dashboard", "calendar", "timeline", "ficha", "residuos", "kpi", "operacao"]) }),
  execute: vi.fn(),
}));

vi.mock("./db", () => ({
  getProjectById: mocks.getProjectById,
  getDb: vi.fn().mockResolvedValue({ execute: mocks.execute }),
}));

import { appRouter } from "./routers";

function caller() {
  return appRouter.createCaller({
    user: { id: 1, openId: "qa-admin", name: "QA Admin", email: "qa-admin@example.invalid", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} },
    res: {},
  } as unknown as TrpcContext);
}

const invoice = { invoiceType: "eletricidade", quantity: "100", unit: "kWh", periodStart: "2026-09-01", periodEnd: "2026-09-30" };

describe("Operação — integração de reconciliação", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve conforme quando o procedimento real encontra leituras válidas dentro da tolerância", async () => {
    mocks.execute.mockResolvedValueOnce([[invoice]]).mockResolvedValueOnce([[{ samples: 1, measured: "104" }]]);
    await expect(caller().operation.reconciliation({ projectId: 60001 })).resolves.toEqual([
      expect.objectContaining({ billed: 100, measured: 104, status: "conforme" }),
    ]);
  });

  it("devolve incompleta quando o procedimento real não encontra leituras válidas no período", async () => {
    mocks.execute.mockResolvedValueOnce([[invoice]]).mockResolvedValueOnce([[{ samples: 0, measured: null }]]);
    await expect(caller().operation.reconciliation({ projectId: 60001 })).resolves.toEqual([
      expect.objectContaining({ billed: 100, measured: null, variance: null, status: "incompleta" }),
    ]);
  });
});
