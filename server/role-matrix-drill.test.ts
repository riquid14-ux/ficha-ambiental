import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const restrictedRoles = ["dono_obra", "pm", "ee", "ee_partner", "raa", "rap", "observador", "user"] as const;

function context(role: (typeof restrictedRoles)[number]): TrpcContext {
  return {
    user: {
      id: 880000 + restrictedRoles.indexOf(role), openId: `matrix-${role}`, email: `${role}@example.invalid`, name: `QA ${role}`, loginMethod: "password", role, companyId: 1,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} }, res: { clearCookie: () => undefined },
  } as unknown as TrpcContext;
}

describe("Drill da matriz de permissões administrativas", () => {
  it.each(restrictedRoles)("recusa a %s em todas as mutações administrativas", async (role) => {
    const caller = appRouter.createCaller(context(role));
    await expect(caller.companies.create({ name: "Empresa bloqueada", shortName: `QB${restrictedRoles.indexOf(role)}`, companyType: "ee", projectIds: [1] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.updateRole({ userId: 1, role: "ee" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.invitations.create({ email: `invite-${role}@example.invalid`, companyId: 1, role: "ee" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
