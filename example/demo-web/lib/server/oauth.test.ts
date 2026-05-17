import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuthorizationRequest, createAuthorizationRequestForRedirectUri } from "./oauth";

const originalEnv = { ...process.env };

describe("demo oauth", () => {
  beforeEach(() => {
    setDemoEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("creates a hosted authorization request for demo-web", () => {
    const request = createAuthorizationRequest();
    const url = new URL(request.url);

    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("demo-web");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:5173/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(request.state).toBeTruthy();
    expect(request.verifier).toBeTruthy();
  });

  it("supports localhost callback URLs without mixing them with 127.0.0.1 state cookies", () => {
    const request = createAuthorizationRequestForRedirectUri("http://localhost:5173/callback");
    const url = new URL(request.url);

    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5173/callback");
    expect(request.redirectUri).toBe("http://localhost:5173/callback");
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
