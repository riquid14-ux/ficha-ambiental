import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "dono_obra"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 990001 : 990002,
      openId: `qa-${role}-management`,
      email: `${role}@example.invalid`,
      name: `QA ${role}`,
      loginMethod: "password",
      role,
      companyId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: () => undefined },
  } as unknown as TrpcContext;
}

describe("Drill de gestão administrativa exclusiva", () => {
  it("recusa ao Dono de Obra a criação e edição de empresas", async () => {
    const caller = appRouter.createCaller(context("dono_obra"));
    await expect(caller.companies.create({ name: "QA bloqueada", shortName: "QAB", companyType: "ee", projectIds: [1] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.companies.update({ id: 1, name: "QA bloqueada" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("recusa ao Dono de Obra a listagem e alteração de pessoas e roles", async () => {
    const caller = appRouter.createCaller(context("dono_obra"));
    await expect(caller.users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.assignCompany({ userId: 1, companyId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.updateRole({ userId: 1, role: "ee" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("recusa ao Dono de Obra a criação, consulta e eliminação de convites", async () => {
    const caller = appRouter.createCaller(context("dono_obra"));
    await expect(caller.invitations.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.invitations.create({ email: "qa-invite@example.invalid", companyId: 1, role: "ee" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.invitations.delete({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
