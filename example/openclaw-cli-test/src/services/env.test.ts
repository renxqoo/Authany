import { afterEach, describe, expect, it } from "vitest";
import { resolveCliEnv } from "./env.js";

const originalEnv = { ...process.env };

describe("resolveCliEnv", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("reads the injected target token and target-service URL", () => {
    restoreEnv({
      AUTHANY_TARGET_ACCESS_TOKEN: "jwt_runtime",
      TARGET_SERVICE_URL: "http://127.0.0.1:3006"
    });

    expect(resolveCliEnv()).toEqual({
      injectedTargetAccessToken: "jwt_runtime",
      targetServiceUrl: "http://127.0.0.1:3006"
    });
  });

  it("falls back to the built-in target-service URL when nothing is provided", () => {
    restoreEnv({
      AUTHANY_TARGET_ACCESS_TOKEN: undefined,
      TARGET_SERVICE_URL: undefined,
      DEMO_TARGET_SERVICE_URL: undefined
    });

    expect(resolveCliEnv()).toEqual({
      injectedTargetAccessToken: undefined,
      targetServiceUrl: "http://127.0.0.1:3006"
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
