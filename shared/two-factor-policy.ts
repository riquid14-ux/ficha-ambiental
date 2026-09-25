export type TwoFactorPolicyUser = {
  totpEnabled?: number | boolean | null;
  createdAt?: Date | string | null;
  twoFactorGraceUntil?: Date | string | null;
};

export const DEFAULT_ENROLLMENT_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

function toTimestamp(value?: Date | string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Política única para o prazo de inscrição no 2FA. É usada tanto pela interface
 * como pelas procedures tRPC, para que a interface nunca seja a única barreira.
 */
export function requiresTwoFactorEnrollment(user: TwoFactorPolicyUser | null | undefined, now = Date.now()) {
  if (!user || Boolean(user.totpEnabled)) return false;
  const extendedDeadline = toTimestamp(user.twoFactorGraceUntil);
  if (extendedDeadline !== null) return now > extendedDeadline;
  const createdAt = toTimestamp(user.createdAt);
  return createdAt !== null && now - createdAt > DEFAULT_ENROLLMENT_GRACE_MS;
}
