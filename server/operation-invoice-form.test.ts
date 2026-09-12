// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ createInvoice: vi.fn(), refetch: vi.fn(), reconciliation: [] as any[], overview: { readings: [], latest: {}, quality: { total: 0, valid: 0, invalid: 0, coveragePercent: 0 }, financial: { invoiceCount: 0, totalCostEur: 0, carbonStatus: "factor_pendente" } } as any }));

vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { id: 60001, code: "SIN01", name: "NEST" }, isAllProjects: false }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/AppLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("recharts", () => {
  const Box = ({ children }: { children?: unknown }) => createElement("div", null, children);
  const Scatter = ({ data, fill }: { data?: unknown[]; fill?: string }) => createElement("div", { "data-testid": `scatter-${fill || "default"}` }, String(data?.length || 0));
  return { Area: Box, AreaChart: Box, CartesianGrid: Box, Legend: Box, Line: Box, LineChart: Box, ResponsiveContainer: Box, Scatter, ScatterChart: Box, Tooltip: Box, XAxis: Box, YAxis: Box };
});
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({ data, refetch: mocks.refetch });
  const mutation = (mutate: (input: unknown) => void = vi.fn()) => ({ mutate, isPending: false });
  return {
    trpc: {
      operation: {
        overview: { useQuery: () => query(mocks.overview) },
        imports: { useQuery: () => query([]) },
        invoices: { useQuery: () => query([]) },
        reconciliation: { useQuery: () => query(mocks.reconciliation) },
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
afterEach(() => { cleanup(); mocks.reconciliation = []; mocks.overview = { readings: [], latest: {}, quality: { total: 0, valid: 0, invalid: 0, coveragePercent: 0 }, financial: { invoiceCount: 0, totalCostEur: 0, carbonStatus: "factor_pendente" } }; });

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

  it("apresenta na interface os estados conforme e incompleta devolvidos pela reconciliação autorizada", async () => {
    mocks.reconciliation = [
      { invoiceType: "eletricidade", periodStart: "2026-09-01", periodEnd: "2026-09-30", billed: 100, measured: 104, unit: "kWh", variance: 0.04, status: "conforme" },
      { invoiceType: "agua_potavel", periodStart: "2026-09-01", periodEnd: "2026-09-30", billed: 12, measured: null, unit: "m³", variance: null, status: "incompleta" },
    ];
    const user = userEvent.setup();
    render(createElement(Operation));
    await user.click(screen.getByRole("tab", { name: /Faturas e reconciliação/i }));
    expect(screen.getByText("Conforme")).toBeTruthy();
    expect(screen.getByText("Incompleta")).toBeTruthy();
    expect(screen.getByText("Sem medição")).toBeTruthy();
  });

  it("apresenta as correlações WUE–ciclos e COP–caudal quando existem pares válidos", () => {
    mocks.overview = {
      readings: [
        { metricCode: "cooling_cycles_15m", metricLabel: "Ciclos de arrefecimento", value: 2, measuredAt: Date.UTC(2026, 8, 11, 0, 0), granularity: "quinze_minutos", dataQuality: "valid" },
        { metricCode: "wue_15m", metricLabel: "WUE de quinze minutos", value: 1.1, measuredAt: Date.UTC(2026, 8, 11, 0, 0), granularity: "quinze_minutos", dataQuality: "valid" },
        { metricCode: "cooling_cycles_15m", metricLabel: "Ciclos de arrefecimento", value: 3, measuredAt: Date.UTC(2026, 8, 11, 0, 15), granularity: "quinze_minutos", dataQuality: "valid" },
        { metricCode: "wue_15m", metricLabel: "WUE de quinze minutos", value: 1.3, measuredAt: Date.UTC(2026, 8, 11, 0, 15), granularity: "quinze_minutos", dataQuality: "valid" },
        { metricCode: "seawater_flow_lps", metricLabel: "Caudal de captação", value: 110, measuredAt: Date.UTC(2026, 8, 10), granularity: "diario", dataQuality: "valid" },
        { metricCode: "seawater_pumping_cop", metricLabel: "COP de bombagem", value: 21, measuredAt: Date.UTC(2026, 8, 10), granularity: "diario", dataQuality: "valid" },
        { metricCode: "seawater_flow_lps", metricLabel: "Caudal de captação", value: 115, measuredAt: Date.UTC(2026, 8, 11), granularity: "diario", dataQuality: "valid" },
        { metricCode: "seawater_pumping_cop", metricLabel: "COP de bombagem", value: 22, measuredAt: Date.UTC(2026, 8, 11), granularity: "diario", dataQuality: "valid" },
      ], latest: {}, quality: { total: 8, valid: 8, invalid: 0, coveragePercent: 100 }, financial: { invoiceCount: 0, totalCostEur: 0, carbonStatus: "factor_pendente" },
    };
    render(createElement(Operation));
    expect(screen.getByText("WUE versus ciclos de arrefecimento")).toBeTruthy();
    expect(screen.getByText("COP versus caudal de captação")).toBeTruthy();
    expect(screen.getByTestId("scatter-#059669").textContent).toBe("2");
    expect(screen.getByTestId("scatter-#0284c7").textContent).toBe("2");
  });
});
