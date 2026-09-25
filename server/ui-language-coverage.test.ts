import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("cobertura de tradução da interface", () => {
  it("bloqueia literais de interface sem tradução conhecida", () => {
    expect(() => execFileSync("node", ["scripts/verify-ui-translation-coverage.mjs"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    })).not.toThrow();
  });

  it("mantém a ponte de idioma limitada a texto estático conhecido", () => {
    const bridge = fs.readFileSync(path.join(root, "client/src/components/UiLanguageBridge.tsx"), "utf8");
    expect(bridge).toContain("uiLiteralTranslations[value]");
    expect(bridge).toContain("Dynamic domain content, user input and regulatory text are untouched");
    expect(bridge).toContain("placeholder");
    expect(bridge).toContain("aria-label");
  });
});
