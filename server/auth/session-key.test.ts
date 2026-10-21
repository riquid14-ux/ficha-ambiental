import { describe, expect, it } from "vitest";
import { deriveLocalSessionKey } from "./session-key";

describe("chave de sessão local", () => {
  it("deriva uma chave de 256 bits para segredos válidos do runtime gerido", () => {
    const key = deriveLocalSessionKey("managed-session-secret-22");

    expect(key).toHaveLength(32);
    expect(Buffer.from(key)).not.toEqual(
      Buffer.from("managed-session-secret-22", "utf8")
    );
    expect(Buffer.from(deriveLocalSessionKey("managed-session-secret-22"))).toEqual(
      Buffer.from(key)
    );
  });

  it("recusa segredos manifestamente fracos", () => {
    expect(() => deriveLocalSessionKey("too-short")).toThrow(
      /pelo menos 16 caracteres/
    );
  });
});
