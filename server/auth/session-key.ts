import { createHash } from "node:crypto";

const MINIMUM_MANAGED_SECRET_LENGTH = 16;
const SESSION_KEY_CONTEXT = "stand:local-session:v1\0";

/**
 * Produz sempre uma chave HMAC-SHA-256 de 256 bits a partir do segredo privado
 * configurado no runtime. O modo corporativo continua a validar 32+ caracteres
 * no arranque; este mínimo permite ao ambiente gerido usar o segredo de sessão
 * que já fornece sem transformar um login válido num erro interno.
 */
export function deriveLocalSessionKey(secret: string): Uint8Array {
  const normalized = secret.trim();
  if (normalized.length < MINIMUM_MANAGED_SECRET_LENGTH) {
    throw new Error(
      "JWT_SECRET tem de ter pelo menos 16 caracteres para assinar sessões."
    );
  }

  return createHash("sha256")
    .update(SESSION_KEY_CONTEXT, "utf8")
    .update(normalized, "utf8")
    .digest();
}
