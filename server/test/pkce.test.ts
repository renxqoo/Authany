import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { PkceService } from "../src/modules/oidc/pkce.service";

describe("PkceService", () => {
  it("verifies S256 code challenge", () => {
    const verifier = "demo-verifier";
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    expect(new PkceService().verify(verifier, challenge, "S256")).toBe(true);
  });

  it("rejects unsupported methods", () => {
    expect(new PkceService().verify("a", "a", "plain")).toBe(false);
  });
});
