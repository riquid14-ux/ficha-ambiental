import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

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
    // Should have 14 sections
    expect(result.length).toBe(14);
  });
});

describe("measures.list", () => {
  it("returns all measures for authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.measures.list();
    expect(Array.isArray(result)).toBe(true);
    // Should have 156 measures
    expect(result.length).toBe(156);
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
