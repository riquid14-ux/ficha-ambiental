// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ deleteEgar: vi.fn(), listRefetch: vi.fn(), wasteMapRefetch: vi.fn() }));

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (value: string) => value }) }));
vi.mock("@/contexts/ProjectContext", () => ({ useProject: () => ({ activeProject: { id: 60001, code: "SIN01", name: "NEST" }, isAllProjects: false }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin", companyId: null } }) }));
vi.mock("@/components/AppLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("wouter", () => ({ useLocation: () => ["/mirr"] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    partners: { myAccess: { useQuery: () => ({ data: null }) } },
    wasteEgars: {
      subprojects: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      list: { useQuery: () => ({ data: [{ id: 77, createdBy: 1, companyId: null, createdAt: new Date().toISOString(), date: Date.now(), egarId: "EGAR-UI-77", lerCode: "150101", designation: "Embalagens de papel e cartão", quantity: "0.001", correctedQuantity: null, destination: "recycled", operator: "Operador", month: 9 }], refetch: mocks.listRefetch }) },
      wasteMap: { useQuery: () => ({ data: [], refetch: mocks.wasteMapRefetch }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      delete: { useMutation: (handlers: { onSuccess?: () => void }) => ({ mutate: (input: unknown) => { mocks.deleteEgar(input); handlers.onSuccess?.(); }, isPending: false }) },
      createSubproject: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import MIRR from "../client/src/pages/MIRR";

beforeAll(() => { Object.defineProperty(window, "matchMedia", { value: () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }) }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("MIRR — diálogo de eliminação de e-GAR", () => {
  it("pede confirmação acessível e atualiza a lista e o Waste Map depois da eliminação autorizada", async () => {
    const user = userEvent.setup();
    render(createElement(MIRR));
    await user.click(screen.getByTitle("Eliminar e-GAR"));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Eliminar e-GAR?")).toBeTruthy();
    expect(within(dialog).getByText(/EGAR-UI-77/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Eliminar e-GAR" }));
    expect(mocks.deleteEgar).toHaveBeenCalledWith({ id: 77 });
    expect(mocks.listRefetch).toHaveBeenCalledOnce();
    expect(mocks.wasteMapRefetch).toHaveBeenCalledOnce();
  });
});
