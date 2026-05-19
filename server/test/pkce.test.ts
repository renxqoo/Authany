import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { PkceService } from "../src/modules/oidc/pkce.service";

describe("PkceService", () => {
  it("verifies S256 code challenge", () => {
    const verifier = "abcdefghijklmnopqrstuvwxyz0123456789-._~ABCDE";
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    expect(new PkceService().verify(verifier, challenge, "S256")).toBe(true);
  });

  it("rejects unsupported methods", () => {
    expect(new PkceService().verify("a", "a", "plain")).toBe(false);
  });

  it("rejects invalid verifier lengths and characters", () => {
    const shortVerifier = "short-verifier";
    const invalidCharacterVerifier = `${"a".repeat(42)}!`;
    const challenge = createHash("sha256").update(shortVerifier).digest("base64url");

    expect(new PkceService().verify(shortVerifier, challenge, "S256")).toBe(false);
    expect(new PkceService().verify(invalidCharacterVerifier, challenge, "S256")).toBe(false);
  });
});
