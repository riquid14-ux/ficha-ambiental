import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("compatibilidade de rotas com Express 5", () => {
  it("usa um wildcard nomeado para a proxy de armazenamento", () => {
    const storageProxy = fs.readFileSync(path.join(projectRoot, "server/_core/storageProxy.ts"), "utf-8");
    expect(storageProxy).toContain('app.get("/manus-storage/*key"');
    expect(storageProxy).toContain("Array.isArray(rawKey)");
  });

  it("usa fallbacks compatíveis com Express 5 em desenvolvimento e produção", () => {
    const vite = fs.readFileSync(path.join(projectRoot, "server/_core/vite.ts"), "utf-8");
    expect(vite).toContain('app.use("/{*splat}"');
    expect(vite).not.toContain('app.use("*"');
  });
});
