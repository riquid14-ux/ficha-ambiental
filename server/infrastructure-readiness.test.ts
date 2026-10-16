import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("preparação para a infraestrutura Fase 1", () => {
  it("inclui upstream com dois nós e preserva IP real no proxy", () => {
    const nginx = source("ops/nginx/stand.conf.example");
    expect(nginx).toContain("upstream stand_app_nodes");
    expect(nginx).toContain("server 10.20.40.14:3000");
    expect(nginx).toContain("server 10.20.40.15:3000");
    expect(nginx).toContain("X-Forwarded-For");
    expect(nginx).toContain("/api/health/ready");
  });

  it("tem timers locais e token dedicado para alertas", () => {
    const scheduler = source("ops/run-scheduled-reminder.mjs");
    const timer = source("ops/systemd/plataforma-weekly-reminder.timer");
    expect(scheduler).toContain("SCHEDULER_TOKEN");
    expect(scheduler).toContain("weekly|deadline");
    expect(timer).toContain("Persistent=true");
    expect(source("ops/systemd/plataforma-weekly-reminder.service")).toContain("/usr/bin/env node");
  });

  it("inclui carga restrita das fotografias institucionais no S3 corporativo", () => {
    const migration = source("ops/migrate-brand-assets.mjs");
    expect(migration).toContain("S3_SECRET_ACCESS_KEY");
    expect(migration).toContain("PutObjectCommand");
    expect(migration).toContain("start-campus-7_9876e6c3.jpg");
    expect(migration).toContain("Não lê nem escreve ficheiros da aplicação em client/public");
  });
});
