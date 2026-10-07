import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isPublicBrandImageKey } from "./brand-media";

const root = resolve(process.cwd());
const brandImages = readFileSync(resolve(root, "client/src/lib/brand-images.ts"), "utf8");
const welcome = readFileSync(resolve(root, "client/src/pages/Welcome.tsx"), "utf8");
const styles = readFileSync(resolve(root, "client/src/index.css"), "utf8");

describe("entrega de fotografia institucional", () => {
  it("expõe apenas ativos institucionais públicos no proxy de mesma origem", () => {
    expect(isPublicBrandImageKey("start-campus-7_9876e6c3.jpg")).toBe(true);
    expect(isPublicBrandImageKey("branding/2026-admin.jpg")).toBe(true);
    expect(isPublicBrandImageKey("rdcd-assets/1/figure.jpg")).toBe(false);
    expect(isPublicBrandImageKey("../private.jpg")).toBe(false);
    expect(isPublicBrandImageKey("https://external.example/image.jpg")).toBe(false);
  });

  it("resolve fotografias de marca no domínio da aplicação em vez de depender do redirect de storage", () => {
    expect(brandImages).toContain('return `/api/brand/media?key=${encodeURIComponent(key)}`');
    expect(welcome).toContain('useBrandImage("welcome")');
  });

  it("mantém imagens de hero e cartões em camadas positivas e visíveis", () => {
    expect(styles).toContain(".stand-os-hero-image { position: absolute; inset: 0; z-index: 0;");
    expect(styles).toContain(".stand-os-visual-command > img { position: absolute; inset: 0; z-index: 0;");
    expect(styles).toContain(".stand-os-command-scrim { position: absolute; inset: 0; z-index: 1;");
    expect(styles).toContain(".stand-page-header-photo { z-index: 0;");
    expect(styles).not.toContain(".stand-os-visual-command > img { position: absolute; inset: 0; z-index: -2;");
  });
});
