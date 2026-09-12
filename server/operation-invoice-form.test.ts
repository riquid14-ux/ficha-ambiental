// @vitest-environment jsdom
import { createElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ createInvoice: vi.fn(), refetch: vi.fn() }));

vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { id: 60001, code: "SIN01", name: "NEST" }, isAllProjects: false }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/AppLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("recharts", () => {
  const Box = ({ children }: { children?: unknown }) => createElement("div", null, children);
  return { Area: Box, AreaChart: Box, CartesianGrid: Box, Legend: Box, Line: Box, LineChart: Box, ResponsiveContainer: Box, Scatter: Box, ScatterChart: Box, Tooltip: Box, XAxis: Box, YAxis: Box };
});
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({ data, refetch: mocks.refetch });
  const mutation = (mutate: (input: unknown) => void = vi.fn()) => ({ mutate, isPending: false });
  return {
    trpc: {
      operation: {
        overview: { useQuery: () => query({ readings: [], latest: {}, quality: { total: 0, valid: 0, invalid: 0, coveragePercent: 0 }, financial: { invoiceCount: 0, totalCostEur: 0, carbonStatus: "factor_pendente" } }) },
        imports: { useQuery: () => query([]) },
        invoices: { useQuery: () => query([]) },
        reconciliation: { useQuery: () => query([]) },
        scenarios: { useQuery: () => query([]) },
        importDailyReport: { useMutation: () => mutation() },
        importInvoicesExcel: { useMutation: () => mutation() },
        createInvoice: { useMutation: () => mutation(mocks.createInvoice) },
        createScenario: { useMutation: () => mutation() },
        deleteScenario: { useMutation: () => mutation() },
        invoiceDownload: { useQuery: () => query(undefined) },
      },
    },
  };
});

import Operation from "../client/src/pages/Operation";

beforeAll(() => { Object.defineProperty(window, "matchMedia", { value: () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }) }); });

describe("Operação — formulário manual de faturas", () => {
  it("submete Eletricidade usando o código normalizado aceite pelo servidor", async () => {
    const user = userEvent.setup();
    mocks.createInvoice.mockClear();
    render(createElement(Operation));
    await user.click(screen.getByRole("tab", { name: /Faturas e reconciliação/i }));
    await user.click(screen.getByRole("button", { name: /Registar fatura/i }));
    await user.type(screen.getByLabelText("Fornecedor"), "QA fornecedor");
    await user.type(screen.getByLabelText("N.º da fatura"), "QA-UI-1");
    await user.type(screen.getByLabelText("Quantidade"), "100");
    await user.type(screen.getByLabelText("Custo total (EUR)"), "123.45");
    await user.click(screen.getByRole("button", { name: "Guardar fatura" }));
    expect(mocks.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ projectId: 60001, invoiceType: "electricidade", quantity: 100, unit: "kWh", totalCost: 123.45 }));
  });
});
