import crypto from "node:crypto";
import type { Request } from "express";
import { TRPCError } from "@trpc/server";
import Redis from "ioredis";

import { ENV } from "./_core/env";

type AttemptBucket = { count: number; resetAt: number };

const ATTEMPTS = new Map<string, AttemptBucket>();
const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = 8;
let valkey: Redis | null | undefined;

function clientAddress(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;
  return firstForwarded || req.ip || req.socket.remoteAddress || "unknown";
}

function keyFor(req: Request, scope: string) {
  const source = `${scope}:${clientAddress(req)}`;
  const digest = crypto.createHash("sha256").update(`${ENV.cookieSecret}:${source}`).digest("hex");
  return `stand:auth-attempt:${digest}`;
}

function localBucket(key: string, now = Date.now()) {
  const existing = ATTEMPTS.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 0, resetAt: now + WINDOW_SECONDS * 1000 };
    ATTEMPTS.set(key, bucket);
    return bucket;
  }
  return existing;
}

function valkeyClient(): Redis | null {
  if (valkey !== undefined) return valkey;
  if (!ENV.valkeyUrl) {
    valkey = null;
    return valkey;
  }
  valkey = new Redis(ENV.valkeyUrl, {
    lazyConnect: true,
    connectTimeout: 1200,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  return valkey;
}

function unavailable(): never {
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: "A proteção de autenticação está temporariamente indisponível. Tente novamente dentro de instantes.",
  });
}

async function distributedGet(key: string): Promise<number | null> {
  const client = valkeyClient();
  if (!client) return null;
  try {
    if (client.status === "wait") await client.connect();
    return Number.parseInt((await client.get(key)) || "0", 10);
  } catch (error) {
    console.error("[AuthRateLimit] Valkey indisponível", error instanceof Error ? error.message : error);
    if (ENV.isProduction) unavailable();
    return null;
  }
}

/** Em produção, a contagem fica em Valkey e é partilhada pelos dois nós web. */
export async function assertAuthenticationAttemptAllowed(req: Request, scope: string) {
  const key = keyFor(req, scope);
  const count = await distributedGet(key);
  if (count !== null) {
    if (count >= MAX_FAILURES) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Demasiadas tentativas. Aguarde cerca de 15 minutos." });
    }
    return;
  }

  const bucket = localBucket(key);
  if (bucket.count >= MAX_FAILURES) {
    const seconds = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Demasiadas tentativas. Aguarde cerca de ${seconds} segundos.` });
  }
}

export async function recordAuthenticationFailure(req: Request, scope: string) {
  const key = keyFor(req, scope);
  const client = valkeyClient();
  if (client) {
    try {
      if (client.status === "wait") await client.connect();
      const pipeline = client.multi();
      pipeline.incr(key);
      pipeline.expire(key, WINDOW_SECONDS, "NX");
      await pipeline.exec();
      return;
    } catch (error) {
      console.error("[AuthRateLimit] Falha ao registar em Valkey", error instanceof Error ? error.message : error);
      if (ENV.isProduction) unavailable();
    }
  }
  localBucket(key).count += 1;
}

export async function clearAuthenticationFailures(req: Request, scope: string) {
  const key = keyFor(req, scope);
  const client = valkeyClient();
  if (client) {
    try {
      if (client.status === "wait") await client.connect();
      await client.del(key);
      return;
    } catch (error) {
      console.error("[AuthRateLimit] Falha ao limpar em Valkey", error instanceof Error ? error.message : error);
      if (ENV.isProduction) unavailable();
    }
  }
  ATTEMPTS.delete(key);
}

export async function assertDistributedRateLimitReady(): Promise<void> {
  if (!ENV.isProduction) return;
  const client = valkeyClient();
  if (!client) throw new Error("VALKEY_URL é obrigatório para limites de autenticação distribuídos.");
  if (client.status === "wait") await client.connect();
  const response = await client.ping();
  if (response !== "PONG") throw new Error("Valkey não respondeu ao teste de conectividade.");
}

export async function resetAuthenticationRateLimitsForTest() {
  ATTEMPTS.clear();
  if (valkey && valkey.status !== "end") await valkey.quit();
  valkey = undefined;
}
