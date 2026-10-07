import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Welcome.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

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

  it("mantém a fotografia do hero acima do fundo e abaixo dos controlos", () => {
    expect(styles).toContain(".stand-os-hero-image { position: absolute; inset: 0; z-index: 0;");
    expect(styles).toContain(".stand-os-hero-wash { position: absolute; inset: 0; z-index: 1;");
    expect(styles).toContain(".stand-os-hero-core { position: relative; z-index: 4;");
    expect(styles).toContain("brightness(1.12)");
  });

  it("só mostra a navegação do ciclo a perfis que podem consultar a timeline", () => {
    expect(source).toContain('const canSeeProjectLifecycle = visiblePaths.includes("/timeline")');
    expect(source).toContain('{canSeeProjectLifecycle && <button');
  });
});
