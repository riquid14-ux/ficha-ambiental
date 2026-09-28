import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("segurança da comunicação de convites", () => {
  it("nunca envia uma palavra-passe fixa e orienta a criação de uma palavra-passe própria", () => {
    const source = readFileSync(resolve(process.cwd(), "server/email.ts"), "utf8");
    const placeholderPassword = ["123", "456"].join("");

    expect(source).toContain("defina uma palavra-passe pessoal");
    expect(source).not.toContain(`palavra-passe inicial: <strong>${placeholderPassword}</strong>`);
    expect(source).not.toContain(`palavra-passe inicial: ${placeholderPassword}`);
  });
});
