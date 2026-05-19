import { afterEach, describe, expect, it } from "vitest";
import { getTargetServiceEnv, loadSharedExampleEnv } from "./env.js";

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
      TARGET_RESOURCE_CODE: undefined,
      JWT_SECRET: undefined,
      DB_HOST: undefined,
      DB_PORT: undefined,
      DB_NAME: undefined,
      DB_USER: undefined,
      DB_PASSWORD: undefined,
    });

    expect(() => getTargetServiceEnv()).toThrow("TARGET_SERVICE_PORT is required for example target-service.");
  });

  it("returns configured example target-service env", () => {
    restoreEnv({
      TARGET_SERVICE_PORT: "3006",
      AUTHANY_ISSUER: "http://127.0.0.1:3000",
      TARGET_SERVICE_AUDIENCE: "demo-target",
      TARGET_RESOURCE_CODE: "demo-target",
      JWT_SECRET: "replace-with-jwt-secret-at-least-32-bytes",
      DB_HOST: "localhost",
      DB_PORT: "5432",
      DB_NAME: "testdb",
      DB_USER: "testuser",
      DB_PASSWORD: "testpass",
    });

    expect(getTargetServiceEnv()).toEqual({
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
    });
  });

  it("does not override explicit process env overrides when shared example env is loaded", () => {
    restoreEnv({
      AUTHANY_ISSUER: "http://127.0.0.1:3100",
    });

    loadSharedExampleEnv();

    expect(process.env.AUTHANY_ISSUER).toBe("http://127.0.0.1:3100");
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
