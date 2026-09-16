import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "../src/secret-crypto";

describe("secret encryption", () => {
  it("round-trips arbitrary secrets (incl. CJK)", () => {
    for (const plain of ["eyJv4.token.abc", "简单密码123", "a", " ".repeat(4) + "x"]) {
      expect(decryptSecret(encryptSecret(plain))).toBe(plain);
    }
  });

  it("ciphertext never contains the plaintext; IV varies per call", () => {
    const a = encryptSecret("secret-token");
    const b = encryptSecret("secret-token");
    expect(a).not.toContain("secret-token");
    expect(a).not.toBe(b); // distinct IVs
    expect(decryptSecret(a)).toBe("secret-token");
    expect(decryptSecret(b)).toBe("secret-token");
  });

  it("blob format is tagged and recognizable", () => {
    expect(isEncryptedSecret(encryptSecret("x"))).toBe(true);
    expect(isEncryptedSecret("plaintext")).toBe(false);
    expect(isEncryptedSecret("")).toBe(false);
  });

  it("tampered ciphertext never yields the plaintext; bad format throws", () => {
    const blob = encryptSecret("secret-value");
    const parts = blob.split(":");
    const hex = parts[2]!;
    const flipped = (parseInt(hex[0]!, 16) ^ 1).toString(16) + hex.slice(1);
    const tampered = `${parts[0]}:${parts[1]}:${flipped}`;
    const result = (() => {
      try {
        return decryptSecret(tampered);
      } catch {
        return null;
      }
    })();
    expect(result).not.toBe("secret-value"); // stream cipher: garbage, not the secret
    expect(() => decryptSecret("v2:aa:bb")).toThrow();
    expect(() => decryptSecret("not-a-blob")).toThrow();
  });
});
