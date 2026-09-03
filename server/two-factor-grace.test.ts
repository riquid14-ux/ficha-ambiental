import { describe, expect, it } from "vitest";
import { requiresTwoFactorEnrollment } from "../client/src/lib/two-factor-policy";

describe("prazo de inscrição em 2FA", () => {
  const now = Date.UTC(2026, 8, 3, 12, 0, 0);

  it("mantém o 2FA activo para contas já protegidas", () => {
    expect(requiresTwoFactorEnrollment({ totpEnabled: true, createdAt: new Date(now - 90 * 86400000) }, now)).toBe(false);
  });

  it("respeita a extensão de 30 dias em vez de bloquear pela data original de criação", () => {
    expect(requiresTwoFactorEnrollment({
      totpEnabled: false,
      createdAt: new Date(now - 90 * 86400000),
      twoFactorGraceUntil: new Date(now + 30 * 86400000),
    }, now)).toBe(false);
  });

  it("volta a exigir 2FA depois do fim da extensão", () => {
    expect(requiresTwoFactorEnrollment({
      totpEnabled: false,
      createdAt: new Date(now - 90 * 86400000),
      twoFactorGraceUntil: new Date(now - 1),
    }, now)).toBe(true);
  });
});
