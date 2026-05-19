import { describe, expect, it } from "vitest";
import { TokenVerificationError } from "@authany/sdk";
import { financeSummary } from "./resource.js";
import type { AnyAccessClaims } from "./auth.js";

describe("target service resources", () => {
  it("TokenVerificationError is usable for auth error handling", () => {
    const error = new TokenVerificationError("Bearer target access token is required.", "missing_token");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("missing_token");
    expect(error.message).toBe("Bearer target access token is required.");
  });

  const baseEnv = {
    port: 3006,
    issuer: "http://127.0.0.1:3000",
    audience: "demo-target",
    targetResource: "demo-target",
    jwtSecret: "replace-with-jwt-secret-at-least-32-bytes",
    dbHost: "localhost",
    dbPort: 5432,
    dbName: "testdb",
    dbUser: "testuser",
    dbPassword: "testpass",
  };

  it("returns protected finance demo data for verified SDK claims", () => {
    const result = financeSummary(
      baseEnv,
      {
        iss: "http://127.0.0.1:3000",
        aud: "demo-target",
        sub: "agent:agent_demo",
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        jti: "jti-demo",
        agent_id: "agent_demo",
        delegation_type: "agent_as_self",
        token_use: "target_access",
        target_resource: "demo-target",
        external_context: { provider: "demo-web" },
      },
    );

    expect(result.access).toMatchObject({
      decision: "allowed",
      subject: "agent:agent_demo",
      agentId: "agent_demo",
      externalContext: { provider: "demo-web" },
    });
    expect(result.data.pendingDeals).toBeGreaterThan(0);
  });

  it("returns finance data for local claims", () => {
    const result = financeSummary(
      baseEnv,
      {
        iss: "target-service-local",
        sub: "user:1",
        username: "demo",
        display_name: "Demo User",
        token_use: "local_access",
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        jti: "jti-local-demo",
      } as AnyAccessClaims,
    );

    expect(result.access).toMatchObject({
      decision: "allowed",
      subject: "user:1",
      issuer: "local",
      username: "demo",
    });
    expect(result.data.pendingDeals).toBeGreaterThan(0);
  });
});
