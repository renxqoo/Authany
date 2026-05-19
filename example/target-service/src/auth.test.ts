import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, signLocalAccessToken, verifyLocalAccessToken, isLocalToken, isLocalClaims, type AnyAccessClaims } from "./auth.js";

const JWT_SECRET = "test-secret-at-least-32-bytes-long!!";

describe("password hashing", () => {
  it("hashes and verifies a password", () => {
    const hash = hashPassword("mypassword");
    expect(hash).toContain(":");
    expect(verifyPassword("mypassword", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashPassword("mypassword");
    expect(verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("rejects malformed hash", () => {
    expect(verifyPassword("whatever", "")).toBe(false);
    expect(verifyPassword("whatever", "nocolon")).toBe(false);
  });
});

describe("JWT signing and verification", () => {
  it("signs and verifies a local access token", async () => {
    const token = await signLocalAccessToken(
      { userId: 1, username: "testuser", displayName: "Test User" },
      JWT_SECRET,
    );

    expect(typeof token).toBe("string");
    const parts = token.split(".");
    expect(parts.length).toBe(3);

    const claims = await verifyLocalAccessToken(token, JWT_SECRET);
    expect(claims.iss).toBe("target-service-local");
    expect(claims.sub).toBe("user:1");
    expect(claims.username).toBe("testuser");
    expect(claims.display_name).toBe("Test User");
    expect(claims.token_use).toBe("local_access");
    expect(claims.jti).toBeDefined();
    expect(claims.exp).toBeDefined();
    expect(claims.iat).toBeDefined();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signLocalAccessToken(
      { userId: 1, username: "testuser", displayName: "Test User" },
      JWT_SECRET,
    );

    await expect(verifyLocalAccessToken(token, "wrong-secret-at-least-32-bytes!!!")).rejects.toThrow();
  });
});

describe("isLocalToken", () => {
  it("returns true for a local token", async () => {
    const token = await signLocalAccessToken(
      { userId: 1, username: "testuser", displayName: "Test User" },
      JWT_SECRET,
    );
    expect(isLocalToken(token)).toBe(true);
  });

  it("returns false for a non-local JWT", () => {
    // Create a fake JWT with a different issuer
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: "http://other-issuer" })).toString("base64url");
    const fakeToken = `${header}.${payload}.fakesig`;
    expect(isLocalToken(fakeToken)).toBe(false);
  });

  it("returns false for invalid strings", () => {
    expect(isLocalToken("")).toBe(false);
    expect(isLocalToken("not.a.jwt")).toBe(false);
    expect(isLocalToken("invalid")).toBe(false);
  });
});

describe("isLocalClaims", () => {
  it("returns true for local claims", () => {
    const claims = {
      iss: "target-service-local" as const,
      sub: "user:1",
      username: "demo",
      display_name: "Demo",
      token_use: "local_access" as const,
      exp: 9999999999,
      iat: 1000000,
      jti: "abc",
    };
    expect(isLocalClaims(claims)).toBe(true);
  });

  it("returns false for SDK claims", () => {
    const claims = {
      iss: "http://127.0.0.1:3000",
      sub: "agent:agent_demo",
    } as unknown as AnyAccessClaims;
    expect(isLocalClaims(claims)).toBe(false);
  });
});
