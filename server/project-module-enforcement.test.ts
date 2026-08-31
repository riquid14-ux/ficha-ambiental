import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

const admin = {
  id: 23190001,
  openId: "project-module-test-admin",
  email: "module-test@example.invalid",
  name: "Admin de teste",
  loginMethod: "password" as const,
  role: "admin" as const,
  companyId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function caller() {
  return appRouter.createCaller({ user: admin, req: { protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext);
}

describe("Módulos activos por projecto", () => {
  it("bloqueia Timeline e Ficha em ACP, mas mantém LMAT1 disponível", async () => {
    const projects = await db.getAllProjects();
    const acp = projects.find(project => project.code === "ACP");
    const lmat1 = projects.find(project => project.code === "LMAT1");
    expect(acp).toBeDefined();
    expect(lmat1).toBeDefined();

    await expect(caller().projectPhases.list({ projectId: acp!.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN", message: "Este módulo não está activo no projecto seleccionado." });
    await expect(caller().submissions.createOrGet({
      projectId: acp!.id,
      weekNumber: 1,
      weekYear: 2026,
      weekStartDate: "2026-01-05",
      weekEndDate: "2026-01-11",
    })).rejects.toMatchObject({ code: "FORBIDDEN", message: "Este módulo não está activo no projecto seleccionado." });
    await expect(caller().projectPhases.list({ projectId: lmat1!.id })).resolves.toEqual(expect.any(Array));
  });
});
