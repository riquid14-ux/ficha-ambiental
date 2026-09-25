import { jwtVerify, SignJWT } from "jose";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";

export const MFA_PENDING_COOKIE = "__Host-mfa_pending";
const MFA_PENDING_TTL_SECONDS = 5 * 60;

function secretKey() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

/** Cria uma prova httpOnly de que a palavra-passe acabou de ser validada. */
export async function createMfaPendingToken(userId: number) {
  return new SignJWT({
    purpose: "mfa-pending",
    userId,
    appId: ENV.appId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_PENDING_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Valida que o segundo fator é apresentado pelo mesmo browser e utilizador. */
export async function verifyMfaPendingRequest(req: Request, expectedUserId: number) {
  const token = parseCookieHeader(req.headers.cookie ?? "")[MFA_PENDING_COOKIE];
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.purpose === "mfa-pending"
      && payload.appId === ENV.appId
      && Number(payload.userId) === expectedUserId;
  } catch {
    return false;
  }
}

export function getMfaPendingCookieOptions(req: Request) {
  return {
    ...getSessionCookieOptions(req),
    maxAge: MFA_PENDING_TTL_SECONDS * 1000,
  };
}
