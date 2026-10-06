import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("identidade fotográfica STAND", () => {
  it("mantém a fotografia visível em modo claro com película editorial moderada", () => {
    expect(css).toContain('saturate(.96) contrast(1.05) brightness(1)');
    expect(css).toContain('rgb(255 255 255 / .78) 0%');
    expect(css).toContain('rgb(255 255 255 / .46) 38%');
  });

  it("preserva uma película distinta e legível para o tema escuro", () => {
    expect(css).toContain('.dark .stand-page-header-photo-overlay');
    expect(css).toContain('rgb(5 32 33 / .84) 0%');
  });
});
