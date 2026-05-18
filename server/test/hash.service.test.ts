import { describe, expect, it } from "vitest";
import { HashService } from "../src/shared/security/hash.service";

describe("HashService", () => {
  it("hashes and verifies secrets", () => {
    const service = new HashService();
    const hash = service.hashSecret("secret");

    expect(service.verifySecret("secret", hash)).toBe(true);
    expect(service.verifySecret("wrong", hash)).toBe(false);
  });

  it("creates stable opaque token hashes", () => {
    const service = new HashService();

    expect(service.hashOpaqueToken("abc")).toBe(service.hashOpaqueToken("abc"));
    expect(service.hashOpaqueToken("abc")).not.toBe("abc");
  });
});
