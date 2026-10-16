import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";

import type { User } from "../../drizzle/schema";
import { COOKIE_NAME, THIRTY_DAYS_MS } from "../../shared/const";
import { ENV } from "../_core/env";
import * as db from "../db";

const LOCAL_SESSION_AUDIENCE = "stand-environmental-web";

type SessionClaims = {
  userId?: number;
  openId?: string;
  sessionVersion?: number;
  audience?: string;
};

function signingKey(): Uint8Array {
  const secret = ENV.cookieSecret;
  if (secret.length < 32) {
    throw new Error("JWT_SECRET tem de ter pelo menos 32 caracteres para assinar sessões.");
  }
  return new TextEncoder().encode(secret);
}

function sessionIssuer(): string {
  return ENV.sessionIssuer || "stand-environmental";
}

function requestSessionToken(req: Request): string | undefined {
  const cookieValue = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (cookieValue) return cookieValue;
  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim() || undefined;
  }
  return undefined;
}

/** Cria uma sessão independente de qualquer fornecedor de hosting ou identidade. */
export async function createLocalSessionToken(
  user: Pick<User, "id" | "openId" | "name" | "email" | "sessionVersion">,
  options: { expiresInMs?: number } = {},
): Promise<string> {
  const expiresInMs = options.expiresInMs ?? THIRTY_DAYS_MS;
  const expiresAt = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({
    userId: user.id,
    openId: user.openId,
    name: user.name || user.email || "",
    sessionVersion: user.sessionVersion ?? 0,
    audience: LOCAL_SESSION_AUDIENCE,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(sessionIssuer())
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(signingKey());
}

/**
 * Valida um cookie ou Bearer token local e volta a carregar a identidade da base
 * de dados. A consulta assegura que role, estado da conta e revogação de sessão
 * são sempre decididos no servidor, inclusive com dois nós de aplicação.
 */
export async function authenticateLocalRequest(req: Request): Promise<User> {
  const token = requestSessionToken(req);
  if (!token) throw new Error("Sessão ausente.");

  let claims: SessionClaims;
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      issuer: sessionIssuer(),
    });
    claims = payload as SessionClaims;
  } catch {
    throw new Error("Sessão inválida ou expirada.");
  }

  if (claims.audience !== LOCAL_SESSION_AUDIENCE) {
    throw new Error("Sessão emitida para outra aplicação.");
  }

  const user = Number.isSafeInteger(claims.userId) && Number(claims.userId) > 0
    ? await db.getUserById(Number(claims.userId))
    : (typeof claims.openId === "string" ? await db.getUserByOpenId(claims.openId) : undefined);

  if (!user || user.accountStatus !== "active") {
    throw new Error("Conta sem acesso ativo.");
  }
  if (typeof claims.openId !== "string" || claims.openId !== user.openId) {
    throw new Error("Sessão não corresponde à identidade ativa.");
  }
  if (Number(claims.sessionVersion ?? -1) !== Number(user.sessionVersion ?? 0)) {
    throw new Error("Sessão revogada.");
  }

  return user;
}
