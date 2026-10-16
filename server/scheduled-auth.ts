import crypto from "node:crypto";
import type { Request } from "express";

import { ENV } from "./_core/env";

/**
 * Valida a credencial de um systemd timer. O token é um segredo de serviço,
 * guardado apenas em /etc/plataforma-ambiental/scheduler.env; nunca é uma sessão
 * de utilizador e nunca é aceite nas rotas tRPC.
 */
export function isAuthorizedSchedulerRequest(req: Request): boolean {
  const configured = ENV.schedulerToken;
  const header = req.headers.authorization;
  if (!configured || typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const supplied = header.slice("Bearer ".length).trim();
  const expected = Buffer.from(configured);
  const received = Buffer.from(supplied);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
