import { ENV } from "./_core/env";

export type RuntimeConfiguration = {
  valid: boolean;
  missing: string[];
};

/** Só as VMs Start Campus ativam dependências obrigatórias de alta disponibilidade. */
export function isCorporateRuntime() {
  return (
    ENV.isProduction && ENV.runtimeMode.trim().toLowerCase() === "corporate"
  );
}

/**
 * Produção não pode cair silenciosamente para memória local ou serviços de
 * desenvolvimento. Esta validação é chamada antes de abrir a porta HTTP.
 */
export function validateProductionRuntime(): RuntimeConfiguration {
  if (!isCorporateRuntime()) return { valid: true, missing: [] };

  const missing: string[] = [];
  if (!ENV.databaseUrl) missing.push("DATABASE_URL");
  if (ENV.cookieSecret.length < 32)
    missing.push("JWT_SECRET (mínimo 32 caracteres)");
  if (!ENV.publicBaseUrl) missing.push("APP_BASE_URL");
  if (!ENV.s3Bucket) missing.push("S3_BUCKET");
  if (!ENV.s3Region) missing.push("S3_REGION");
  if (!ENV.s3AccessKeyId) missing.push("S3_ACCESS_KEY_ID");
  if (!ENV.s3SecretAccessKey) missing.push("S3_SECRET_ACCESS_KEY");
  if (!ENV.valkeyUrl) missing.push("VALKEY_URL");
  if (!ENV.schedulerToken) missing.push("SCHEDULER_TOKEN");
  if ((ENV.storageProvider || "s3").toLowerCase() === "manus")
    missing.push("STORAGE_PROVIDER=s3");

  return { valid: missing.length === 0, missing };
}

export function assertProductionRuntime(): void {
  const result = validateProductionRuntime();
  if (!result.valid) {
    throw new Error(
      `Configuração de produção incompleta: ${result.missing.join(", ")}`
    );
  }
}
