import { afterEach, describe, expect, it } from "vitest";
import { getTargetServiceEnv } from "./env.js";

const originalEnv = { ...process.env };

describe("getTargetServiceEnv", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("fails closed when required env is missing", () => {
    restoreEnv({
      TARGET_SERVICE_PORT: undefined,
      AUTHANY_ISSUER: undefined,
      TARGET_SERVICE_AUDIENCE: undefined,
      TARGET_RESOURCE_CODE: undefined
    });

    expect(() => getTargetServiceEnv()).toThrow("TARGET_SERVICE_PORT is required for example target-service.");
  });

  it("returns configured example target-service env", () => {
    restoreEnv({
      TARGET_SERVICE_PORT: "3006",
      AUTHANY_ISSUER: "http://127.0.0.1:3000",
      TARGET_SERVICE_AUDIENCE: "demo-target",
      TARGET_RESOURCE_CODE: "demo-target"
    });

    expect(getTargetServiceEnv()).toEqual({
      port: 3006,
      issuer: "http://127.0.0.1:3000",
      audience: "demo-target",
      targetResource: "demo-target"
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
