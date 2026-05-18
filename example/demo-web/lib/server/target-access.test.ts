import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accessLarkEbfxResource,
  accessTargetResource,
  buildAgentOnlyTargetTokenPayload,
  buildRequesterTokenPayload,
  buildTargetTokenPayload,
  readOperatorSubjectFromSession
} from "./target-access";

const originalEnv = { ...process.env };

describe("target access helpers", () => {
  beforeEach(() => {
    setDemoEnv();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv();
  });
  it("reads the operator subject from userinfo", () => {
    expect(readOperatorSubjectFromSession({
      accessToken: "access",
      expiresAt: Date.now() + 1000,
      userInfo: { sub: "operator:operator_1" }
    })).toBe("operator:operator_1");
  });

  it("builds a target token request with signed external context passthrough", () => {
    expect(buildTargetTokenPayload({ provider: "demo-web", operator_subject: "operator:operator_1" })).toMatchObject({
      grant_type: "urn:authany:params:oauth:grant-type:target-access",
      target_resource: "demo-target"
    });
  });

  it("builds an agent-only target token request without external context", () => {
    expect(buildAgentOnlyTargetTokenPayload()).toMatchObject({
      grant_type: "urn:authany:params:oauth:grant-type:target-access",
      target_resource: "demo-target"
    });
  });

  it("builds requester token payloads for application and agent principals", () => {
    expect(buildRequesterTokenPayload("application", { provider: "demo-web" })).toMatchObject({
      principal_type: "application",
      app_id: "demo-web",
      target_resource: "demo-target"
    });
    expect(buildRequesterTokenPayload("agent")).toMatchObject({
      principal_type: "agent",
      agent_id: "agent_demo",
      runtime_id: "runtime_demo_cli"
    });
  });

  it("omits runtime_id when the demo runtime is not configured", () => {
    restoreEnv({ DEMO_RUNTIME_ID: undefined });

    expect(buildRequesterTokenPayload("agent")).toMatchObject({
      principal_type: "agent",
      agent_id: "agent_demo"
    });
    expect(buildRequesterTokenPayload("agent")).not.toHaveProperty("runtime_id");
  });

  it("returns an actionable error when session has no operator subject", async () => {
    await expect(accessTargetResource({
      accessToken: "access",
      expiresAt: Date.now() + 1000,
      userInfo: {}
    })).resolves.toMatchObject({
      ok: false,
      stage: "session"
    });
  });

  it("returns an EBFX authorization link when the Lark sender is not authorized by EBFX", async () => {
    await expect(accessLarkEbfxResource("ou_unknown")).resolves.toMatchObject({
      ok: false,
      stage: "ebfx-authorization",
      code: "target_authorization_required",
      loginUrl: expect.stringContaining("sender_id=ou_unknown")
    });
  });

  it("returns requester-token errors instead of throwing 500s", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      code: "invalid_app_secret",
      message: "Application secret is invalid."
    }, { status: 401 })));

    await expect(accessTargetResource({
      accessToken: "access",
      expiresAt: Date.now() + 1000,
      userInfo: { sub: "operator:operator_1" }
    })).resolves.toMatchObject({
      ok: false,
      stage: "requester-token",
      targetStatus: 401,
      data: { code: "invalid_app_secret" }
    });
  });
});

function setDemoEnv() {
  restoreEnv({
    AUTHANY_INTERNAL_URL: "http://127.0.0.1:3000",
    DEMO_WEB_CLIENT_ID: "demo-web",
    DEMO_WEB_CLIENT_SECRET: "secret_demo",
    DEMO_WEB_REDIRECT_URI: "http://127.0.0.1:5173/callback",
    DEMO_WEB_SESSION_SECRET: "demo-session-secret",
    DEMO_AGENT_ID: "agent_demo",
    DEMO_RUNTIME_ID: "runtime_demo_cli",
    DEMO_AGENT_CREDENTIAL: "credential_demo",
    DEMO_TARGET_RESOURCE: "demo-target",
    DEMO_TARGET_SERVICE_URL: "http://127.0.0.1:3006"
  });
}

function restoreEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries({ ...originalEnv, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}
