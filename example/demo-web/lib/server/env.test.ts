import { afterEach, describe, expect, it } from "vitest";
import { getDemoEnv } from "./env";

const originalEnv = { ...process.env };

describe("getDemoEnv", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("fails closed when any required demo env is missing", () => {
    restoreEnv({
      AUTHANY_INTERNAL_URL: undefined,
      DEMO_WEB_CLIENT_ID: undefined,
      DEMO_WEB_CLIENT_SECRET: undefined,
      DEMO_WEB_REDIRECT_URI: undefined,
      DEMO_WEB_SESSION_SECRET: undefined,
      DEMO_AGENT_ID: undefined,
      DEMO_RUNTIME_ID: undefined,
      DEMO_AGENT_CREDENTIAL: undefined,
      DEMO_TARGET_RESOURCE: undefined,
      DEMO_TARGET_SERVICE_URL: undefined
    });

    expect(() => getDemoEnv()).toThrow(
      "AUTHANY_INTERNAL_URL, DEMO_WEB_CLIENT_ID, DEMO_WEB_CLIENT_SECRET, DEMO_WEB_REDIRECT_URI, DEMO_WEB_SESSION_SECRET, DEMO_AGENT_ID, DEMO_RUNTIME_ID, DEMO_AGENT_CREDENTIAL, DEMO_TARGET_RESOURCE, and DEMO_TARGET_SERVICE_URL are required.",
    );
  });

  it("returns configured values without implicit defaults", () => {
    restoreEnv({
      AUTHANY_INTERNAL_URL: "https://authany.internal",
      DEMO_WEB_CLIENT_ID: "demo-web",
      DEMO_WEB_CLIENT_SECRET: "secret_demo",
      DEMO_WEB_REDIRECT_URI: "https://demo.example.com/callback",
      DEMO_WEB_SESSION_SECRET: "demo-session-secret",
      DEMO_AGENT_ID: "agent_demo",
      DEMO_RUNTIME_ID: "runtime_demo_cli",
      DEMO_AGENT_CREDENTIAL: "credential_demo",
      DEMO_TARGET_RESOURCE: "demo-target",
      DEMO_TARGET_SERVICE_URL: "https://target.example.com"
    });

    expect(getDemoEnv()).toMatchObject({
      authanyBaseUrl: "https://authany.internal",
      clientId: "demo-web",
      clientSecret: "secret_demo",
      redirectUri: "https://demo.example.com/callback",
      sessionSecret: "demo-session-secret",
      agentId: "agent_demo",
      runtimeId: "runtime_demo_cli",
      agentCredential: "credential_demo",
      targetResource: "demo-target",
      targetServiceUrl: "https://target.example.com",
      cookieName: "authany_demo_session"
    });
  });
});

function restoreEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries({ ...originalEnv, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}
