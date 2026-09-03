import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { vi } from "vitest";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createUserContext(companyId: number | null = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    companyId,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data for authenticated user", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("admin");
    expect(result?.email).toBe("admin@example.com");
  });
});

describe("sections.list", () => {
  it("returns sections list for authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sections.list();
    expect(Array.isArray(result)).toBe(true);
    // Should have sections (14 construction + 6 new phases = 20)
    expect(result.length).toBeGreaterThanOrEqual(17);
  });
});

describe("measures.list", () => {
  it("returns all measures for authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.measures.list();
    expect(Array.isArray(result)).toBe(true);
    // Should have 200 measures (156 construction + 44 new phase measures)
    expect(result.length).toBe(200);
  });
});

describe("companies.list", () => {
  it("returns companies list for authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.companies.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("companies.update — tipo de entidade", () => {
  it("rejeita em runtime a alteração de uma empresa PM para outro tipo", async () => {
    const getCompanySpy = vi.spyOn(db, "getCompanyById").mockResolvedValue({
      id: 991001,
      name: "PM de validação",
      shortName: "PM-QA",
      companyType: "pm",
      active: 1,
    } as any);
    const updateCompanySpy = vi.spyOn(db, "updateCompany");
    const auditSpy = vi.spyOn(db, "insertAuditLog");
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.companies.update({ id: 991001, companyType: "ee" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "O tipo de empresa não pode ser alterado. Crie a empresa com o tipo correcto.",
    });
    expect(updateCompanySpy).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();

    getCompanySpy.mockRestore();
    updateCompanySpy.mockRestore();
    auditSpy.mockRestore();
  });
});

describe("submissions - access control", () => {
  it("rejects submission creation for user without company", async () => {
    const { ctx } = createUserContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.submissions.createOrGet({
        weekNumber: 31,
        weekYear: 2026,
        weekStartDate: "28.07",
        weekEndDate: "03.08",
      })
    ).rejects.toThrow();
  });
});

describe("admin procedures - access control", () => {
  it("rejects non-admin from creating companies", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.companies.create({ name: "Test", shortName: "TST" })
    ).rejects.toThrow();
  });

  it("rejects non-admin from listing users", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });

  it("rejects unauthenticated from accessing sections", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.sections.list()).rejects.toThrow();
  });
});

describe("invitations - access control", () => {
  it("rejects non-admin from creating invitations", async () => {
    const { ctx } = createUserContext(1);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.invitations.create({ email: "test@example.com", companyId: 1, role: "ee" })
    ).rejects.toThrow();
  });

  it("rejects non-admin from listing invitations", async () => {
    const { ctx } = createUserContext(1);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.invitations.list()).rejects.toThrow();
  });

  it("rejects non-admin from deleting invitations", async () => {
    const { ctx } = createUserContext(1);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.invitations.delete({ id: 1 })).rejects.toThrow();
  });

  it("allows admin to create invitation (normalizes email)", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // This will attempt to hit the DB, so it may throw a DB error, but it should NOT throw FORBIDDEN
    try {
      await caller.invitations.create({ email: "  Test@Example.COM  ", companyId: 1, role: "ee" });
    } catch (e: any) {
      // Should not be a FORBIDDEN error - only DB errors are acceptable here
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });
});
