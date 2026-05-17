import { afterEach, describe, expect, it } from "vitest";
import { getAdminEnv } from "./env";

const originalEnv = { ...process.env };

describe("getAdminEnv", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("fails closed when any required admin env is missing", () => {
    restoreEnv({
      AUTHANY_INTERNAL_URL: undefined,
      AUTHANY_ADMIN_CLIENT_ID: undefined,
      AUTHANY_ADMIN_CLIENT_SECRET: undefined,
      ADMIN_WEB_PUBLIC_URL: undefined,
      ADMIN_WEB_SESSION_SECRET: undefined
    });

    expect(() => getAdminEnv()).toThrow(
      "AUTHANY_INTERNAL_URL, AUTHANY_ADMIN_CLIENT_ID, AUTHANY_ADMIN_CLIENT_SECRET, ADMIN_WEB_PUBLIC_URL, and ADMIN_WEB_SESSION_SECRET are required.",
    );
  });

  it("returns configured values without implicit defaults", () => {
    restoreEnv({
      AUTHANY_INTERNAL_URL: "https://authany.internal",
      AUTHANY_ADMIN_CLIENT_ID: "authany-admin-web",
      AUTHANY_ADMIN_CLIENT_SECRET: "secret_admin",
      ADMIN_WEB_PUBLIC_URL: "https://admin.example.com",
      ADMIN_WEB_SESSION_SECRET: "admin-session-secret"
    });

    expect(getAdminEnv()).toMatchObject({
      authanyBaseUrl: "https://authany.internal",
      adminClientId: "authany-admin-web",
      adminClientSecret: "secret_admin",
      publicBaseUrl: "https://admin.example.com",
      sessionSecret: "admin-session-secret",
      cookieName: "authany_admin_session"
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
