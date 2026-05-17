import { describe, expect, it } from "vitest";
import { assertDelegationClaims, bearerToken, TargetAuthError } from "./auth.js";
import { financeSummary } from "./resource.js";

describe("target service auth and resources", () => {
  it("requires bearer tokens", () => {
    expect(() => bearerToken()).toThrow(TargetAuthError);
    expect(bearerToken("Bearer abc")).toBe("abc");
  });

  it("requires subject and principal claims", () => {
    expect(() => assertDelegationClaims({ sub: "agent:agent_demo" })).toThrow(TargetAuthError);
    expect(() => assertDelegationClaims({
      sub: "agent:agent_demo",
      agent_id: "agent_demo",
      token_use: "requester_assertion"
    })).toThrow(TargetAuthError);
    expect(assertDelegationClaims({ sub: "agent:agent_demo", agent_id: "agent_demo", token_use: "target_access" })).toMatchObject({
      sub: "agent:agent_demo",
      agent_id: "agent_demo"
    });
    expect(assertDelegationClaims({ sub: "app:demo-web", app_id: "demo-web", token_use: "target_access" })).toMatchObject({
      sub: "app:demo-web",
      app_id: "demo-web"
    });
  });

  it("returns protected finance demo data for verified claims", () => {
    const result = financeSummary(
      {
        port: 3006,
        issuer: "http://127.0.0.1:3000",
        audience: "demo-target",
        targetResource: "demo-target"
      },
      {
        sub: "agent:agent_demo",
        agent_id: "agent_demo",
        delegation_type: "agent_as_self",
        token_use: "target_access",
        external_context: { provider: "demo-web" }
      },
    );

    expect(result.access).toMatchObject({
      decision: "allowed",
      subject: "agent:agent_demo",
      agentId: "agent_demo",
      externalContext: { provider: "demo-web" }
    });
    expect(result.data.pendingDeals).toBeGreaterThan(0);
  });
});
