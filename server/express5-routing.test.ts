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

  it("serve fotografia institucional através de uma rota de mesma origem", () => {
    const server = fs.readFileSync(path.join(projectRoot, "server/_core/index.ts"), "utf-8");
    const brandMedia = fs.readFileSync(path.join(projectRoot, "server/brand-media.ts"), "utf-8");
    expect(server).toContain("registerBrandMediaRoutes(app)");
    expect(brandMedia).toContain('app.get("/api/brand/media"');
    expect(brandMedia).toContain("Readable.fromWeb(upstream.body as never).pipe(res)");
  });

  it("usa fallbacks compatíveis com Express 5 em desenvolvimento e produção", () => {
    const vite = fs.readFileSync(path.join(projectRoot, "server/_core/vite.ts"), "utf-8");
    expect(vite).toContain('app.use("/{*splat}"');
    expect(vite).not.toContain('app.use("*"');
  });
});
