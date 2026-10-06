import { describe, expect, it, beforeEach } from "vitest";
import type { Request } from "express";
import fs from "node:fs";
import path from "node:path";
import { requiresTwoFactorEnrollment } from "@shared/two-factor-policy";
import { createMfaPendingToken, MFA_PENDING_COOKIE, verifyMfaPendingRequest } from "./_core/mfa";
import {
  assertAuthenticationAttemptAllowed,
  recordAuthenticationFailure,
  resetAuthenticationRateLimitsForTest,
} from "./auth-rate-limit";
import { isPublicBrandingKey, isSafeStorageKey } from "./storage-authorization";

function requestWithCookies(cookie = "") {
  return {
    headers: { cookie },
    ip: "203.0.113.10",
    socket: { remoteAddress: "203.0.113.10" },
  } as unknown as Request;
}

const projectRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("endurecimento de segurança", () => {
  beforeEach(() => resetAuthenticationRateLimitsForTest());

  it("exige 2FA também na camada de servidor depois do período de inscrição", () => {
    const now = Date.UTC(2026, 8, 25);
    expect(requiresTwoFactorEnrollment({ totpEnabled: false, createdAt: new Date(now - 31 * 86400000) }, now)).toBe(true);
    expect(requiresTwoFactorEnrollment({ totpEnabled: true, createdAt: new Date(now - 90 * 86400000) }, now)).toBe(false);
  });

  it("vincula o desafio MFA ao utilizador que acabou de validar a palavra-passe", async () => {
    const token = await createMfaPendingToken(41);
    const req = requestWithCookies(`${MFA_PENDING_COOKIE}=${token}`);
    await expect(verifyMfaPendingRequest(req, 41)).resolves.toBe(true);
    await expect(verifyMfaPendingRequest(req, 42)).resolves.toBe(false);
  });

  it("rejeita nomes de ficheiro perigosos e só liberta ativos públicos conhecidos", () => {
    expect(isSafeStorageKey("evidence/10/photo.png")).toBe(true);
    expect(isSafeStorageKey("../secreto.pdf")).toBe(false);
    expect(isSafeStorageKey("evidence/%2e%2e/secreto.pdf")).toBe(false);
    expect(isPublicBrandingKey("sc-aerial-1_176e4635.jpg")).toBe(true);
    expect(isPublicBrandingKey("evidence/10/photo.png")).toBe(false);
  });

  it("limita repetidas tentativas de autenticação por origem", () => {
    const req = requestWithCookies();
    for (let attempt = 0; attempt < 8; attempt += 1) recordAuthenticationFailure(req, "password:teste@startcampus.pt");
    expect(() => assertAuthenticationAttemptAllowed(req, "password:teste@startcampus.pt")).toThrow(/Demasiadas tentativas/);
  });

  it("desativa a rota legada de upload sem validação de âmbito", () => {
    const source = readSource("server/upload.ts");
    expect(source).toContain("res.status(410)");
    expect(source).not.toContain("storagePut(");
    expect(source).not.toContain("addEvidenceImage(");
  });

  it("impõe troca da palavra-passe temporária antes de chamadas protegidas", () => {
    const source = readSource("server/_core/trpc.ts");
    const loginSource = readSource("client/src/pages/Login.tsx");
    const routerSource = readSource("server/routers.ts");
    const userSchema = readSource("drizzle/schema.ts");
    const passwordDefaultMigration = readSource(
      "drizzle/0066_user_password_defaults.sql"
    );
    expect(source).toContain("Altere a palavra-passe temporária antes de aceder à plataforma.");
    expect(source).toContain("auth.changePassword");
    expect(source).toContain("ctx.user.mustChangePassword");
    expect(loginSource).toContain("!user.mustChangePassword && viewMode === \"login\"");
    expect(routerSource).toContain("mustChangePassword = 1 WHERE id = ${input.userId}");
    expect(userSchema).toContain('mustChangePassword: int("mustChangePassword").default(0)');
    expect(passwordDefaultMigration).toContain("MODIFY COLUMN `mustChangePassword` int DEFAULT 0");
  });

  it("restringe mutações autenticadas à origem servida", () => {
    const source = readSource("server/_core/trpc.ts");
    expect(source).toContain('request.get("origin")');
    expect(source).toContain('typeof request.get === "function"');
    expect(source).toContain("Origem de pedido não autorizada.");
  });

  it("verifica o projeto de cada ficha antes da exportação PDF", () => {
    const source = readSource("server/pdf.ts");
    expect(source).toContain("canReadSubmissionPdf");
    expect(source).toContain('canExportProjectPdf(user, submission.projectId, "ficha")');
    expect(source).toContain("Sem permissão para uma ou mais fichas selecionadas");
  });

  it("mantém medidas e secções analíticas dentro do âmbito autorizado", () => {
    const source = readSource("server/db.ts");
    expect(source).toContain("scopedProjectIds");
    expect(source).toContain("inArray(measures.projectId, scopedProjectIds)");
    expect(source).toContain("inArray(sections.projectId, scopedProjectIds)");
  });

  it("guarda tokens de recuperação apenas como hash", () => {
    const source = readSource("server/routers.ts");
    expect(source).toContain('crypto.createHash("sha256").update(token).digest("hex")');
    expect(source).toContain("crypto.timingSafeEqual");
  });
});
