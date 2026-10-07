import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Welcome.tsx"), "utf8");

describe("Bem-vindo — vídeo institucional", () => {
  it("só remove o poster quando o fornecedor confirma reprodução efetiva", () => {
    expect(source).toContain('payload?.event === "onStateChange" && payload?.info === 1');
    expect(source).not.toContain('[1, 3].includes(payload?.info)');
  });

  it("mantém a fotografia institucional disponível como fallback interativo", () => {
    expect(source).toContain('setVideoPlaying(false)');
    expect(source).toContain('onClick={() => setVideoPlaying(true)}');
    expect(source).toContain('welcomeHeaderImage.url');
  });

  it("só mostra a navegação do ciclo a perfis que podem consultar a timeline", () => {
    expect(source).toContain('const canSeeProjectLifecycle = visiblePaths.includes("/timeline")');
    expect(source).toContain('{canSeeProjectLifecycle && <button');
  });
});
