import type { Request } from "express";
import { TRPCError } from "@trpc/server";

type AttemptBucket = { count: number; resetAt: number };

const ATTEMPTS = new Map<string, AttemptBucket>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

function clientAddress(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;
  return firstForwarded || req.ip || req.socket.remoteAddress || "unknown";
}

function bucketFor(key: string, now = Date.now()) {
  const existing = ATTEMPTS.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 0, resetAt: now + WINDOW_MS };
    ATTEMPTS.set(key, bucket);
    return bucket;
  }
  return existing;
}

function keyFor(req: Request, scope: string) {
  return `${scope}:${clientAddress(req)}`;
}

/** Limitação em memória: proteção imediata complementada por rate-limit de edge/servidor em produção. */
export function assertAuthenticationAttemptAllowed(req: Request, scope: string) {
  const bucket = bucketFor(keyFor(req, scope));
  if (bucket.count >= MAX_FAILURES) {
    const seconds = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Demasiadas tentativas. Aguarde cerca de ${seconds} segundos.` });
  }
}

export function recordAuthenticationFailure(req: Request, scope: string) {
  const bucket = bucketFor(keyFor(req, scope));
  bucket.count += 1;
}

export function clearAuthenticationFailures(req: Request, scope: string) {
  ATTEMPTS.delete(keyFor(req, scope));
}

export function resetAuthenticationRateLimitsForTest() {
  ATTEMPTS.clear();
}
