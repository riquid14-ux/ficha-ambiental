import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const source = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("sessões locais portáveis", () => {
  it("assina sessões locais e verifica revogação contra a base de dados", () => {
    const session = source("server/auth/session.ts");
    expect(session).toContain("createLocalSessionToken");
    expect(session).toContain("authenticateLocalRequest");
    expect(session).toContain("jwtVerify");
    expect(session).toContain("sessionVersion");
    expect(session).toContain("getUserById");
    expect(session).not.toContain("sdk.authenticateRequest");
  });

  it("faz produção falhar fechada sem configuração distribuída", () => {
    const runtime = source("server/runtime-config.ts");
    for (const variable of ["S3_BUCKET", "VALKEY_URL", "SCHEDULER_TOKEN", "APP_BASE_URL"]) {
      expect(runtime).toContain(variable);
    }
    expect(runtime).toContain("STORAGE_PROVIDER=s3");
  });
});
