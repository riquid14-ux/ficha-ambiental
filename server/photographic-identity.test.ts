import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("identidade fotográfica STAND", () => {
  it("mantém a fotografia visível em modo claro com película editorial moderada", () => {
    expect(css).toContain('saturate(1.02) contrast(1.04) brightness(1.04)');
    expect(css).toContain('rgb(255 255 255 / .74) 0%');
    expect(css).toContain('rgb(255 255 255 / .40) 38%');
    expect(css).toContain('.stand-page-header-content { z-index: 2; }');
  });

  it("preserva uma película distinta e legível para o tema escuro", () => {
    expect(css).toContain('.dark .stand-page-header-photo-overlay');
    expect(css).toContain('rgb(5 32 33 / .74) 0%');
  });
});
