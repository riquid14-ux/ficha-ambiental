import { describe, expect, it, beforeEach } from "vitest";
import type { Request } from "express";
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
});
