import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const allRoles = ["admin", "dono_obra", "pm", "ee", "ee_partner", "raa", "rap", "observador"] as const;
type Role = (typeof allRoles)[number];

function context(role: Role): TrpcContext {
  return {
    user: {
      id: 870000 + allRoles.indexOf(role), openId: `read-matrix-${role}`, email: `${role}-read@example.invalid`, name: `QA ${role}`, loginMethod: "password", role,
      companyId: role === "ee" || role === "ee_partner" || role === "rap" ? 1 : null,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} }, res: { clearCookie: () => undefined },
  } as unknown as TrpcContext;
}

describe("Drill de leituras sensíveis por função", () => {
  it.each(allRoles)("aplica a matriz de leitura do Mapa a %s", async (role) => {
    const request = appRouter.createCaller(context(role)).projectMap.overview();
    if (["admin", "dono_obra", "pm"].includes(role)) {
      await expect(request).resolves.toMatchObject({ baseMap: expect.any(Object), projects: expect.any(Array) });
    } else {
      await expect(request).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it.each(allRoles.filter(role => role !== "ee"))("recusa o Dashboard Parceiros a %s antes da leitura de dados", async (role) => {
    const caller = appRouter.createCaller(context(role));
    await expect(caller.partnerDashboard.entities({ projectId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.partnerDashboard.kpiMatrix({ projectId: 1, year: 2026, startWeek: 1, endWeek: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.partnerDashboard.kpiSeries({ projectId: 1, year: 2026, companyId: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.partnerDashboard.wasteMap({ projectId: 1, year: 2026, companyId: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(allRoles.filter(role => role !== "ee"))("recusa Pedidos EEP a %s antes da leitura de dados", async (role) => {
    await expect(appRouter.createCaller(context(role)).eepRequests.mine()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
