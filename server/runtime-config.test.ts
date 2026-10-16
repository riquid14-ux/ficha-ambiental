import { afterEach, describe, expect, it, vi } from "vitest";

const relevantKeys = [
  "NODE_ENV",
  "STAND_RUNTIME_MODE",
  "DATABASE_URL",
  "JWT_SECRET",
  "APP_BASE_URL",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "VALKEY_URL",
  "SCHEDULER_TOKEN",
] as const;

async function readConfiguration(values: Record<string, string | undefined>) {
  for (const key of relevantKeys) vi.stubEnv(key, values[key] ?? "");
  vi.resetModules();
  const { validateProductionRuntime } = await import("./runtime-config");
  return validateProductionRuntime();
}

afterEach(() => vi.unstubAllEnvs());

describe("modo de runtime", () => {
  it("não exige serviços internos no alojamento gerido", async () => {
    const result = await readConfiguration({
      NODE_ENV: "production",
      STAND_RUNTIME_MODE: "managed",
    });
    expect(result).toEqual({ valid: true, missing: [] });
  });

  it("falha fechada nas VMs corporativas sem os serviços obrigatórios", async () => {
    const result = await readConfiguration({
      NODE_ENV: "production",
      STAND_RUNTIME_MODE: "corporate",
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(["DATABASE_URL", "VALKEY_URL", "SCHEDULER_TOKEN"])
    );
  });

  it("aceita o conjunto mínimo explicitamente configurado para a Fase 1", async () => {
    const result = await readConfiguration({
      NODE_ENV: "production",
      STAND_RUNTIME_MODE: "corporate",
      DATABASE_URL: "mysql://app:password@db/stand",
      JWT_SECRET:
        "a-secure-corporate-session-secret-of-more-than-32-characters",
      APP_BASE_URL: "https://stand.example",
      S3_BUCKET: "stand-private",
      S3_REGION: "eu-west-1",
      S3_ACCESS_KEY_ID: "service-user",
      S3_SECRET_ACCESS_KEY: "service-secret",
      VALKEY_URL: "rediss://valkey",
      SCHEDULER_TOKEN: "a-dedicated-scheduler-token-with-32-characters",
    });
    expect(result).toEqual({ valid: true, missing: [] });
  });
});
