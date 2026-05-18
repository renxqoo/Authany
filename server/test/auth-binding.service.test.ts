import { describe, expect, it } from "vitest";
import { AuthService } from "../src/modules/auth/auth.service";
import { HashService } from "../src/shared/security/hash.service";
import { LoginSessionService } from "../src/shared/security/login-session.service";
import { normalizeReturnTo, renderHostedLoginPage } from "../src/modules/auth/hosted-login";
import { createMockConfig, createMockPrisma, getErrorCode } from "./test-helpers";
import { createAllowingRateLimit } from "./security-test-helpers";

describe("operator authentication", () => {
  it("logs in active operators and creates operator sessions", async () => {
    const prisma = createMockPrisma();
    const hashes = new HashService();
    const redis = createSessionRedis();
    prisma.operatorAccount.findFirst.mockResolvedValue({
      id: "operator_1",
      username: "admin",
      passwordHash: hashes.hashSecret("admin123"),
      displayName: "Admin",
      status: "active"
    });
    const service = new AuthService(
      prisma as never,
      hashes,
      new LoginSessionService(createMockConfig() as never, redis as never),
      createAllowingRateLimit() as never,
      createMockConfig() as never,
      { record: async () => undefined } as never,
      { get: async () => null, increment: async () => 0, delete: async () => undefined, set: async () => undefined } as never,
    );

    const result = await service.login("admin", "admin123");

    expect(result.operator.id).toBe("operator_1");
    expect(await new LoginSessionService(createMockConfig() as never, redis as never).parse(result.sessionCookie)).toMatchObject({
      operatorId: "operator_1"
    });
  });

  it("rejects invalid operator credentials", async () => {
    const prisma = createMockPrisma();
    prisma.operatorAccount.findFirst.mockResolvedValue(null);
    const service = new AuthService(
      prisma as never,
      new HashService(),
      new LoginSessionService(createMockConfig() as never, createSessionRedis() as never),
      createAllowingRateLimit() as never,
      createMockConfig() as never,
      { record: async () => undefined } as never,
      { get: async () => null, increment: async () => 0, delete: async () => undefined, set: async () => undefined } as never,
    );

    await expectErrorCode(service.login("admin", "wrong"), "invalid_credentials");
  });

  it("keeps hosted login redirects relative and renders a form", () => {
    expect(normalizeReturnTo("https://evil.test/callback")).toBe("/");
    expect(normalizeReturnTo("/oauth/authorize?client_id=demo")).toBe("/oauth/authorize?client_id=demo");
    expect(renderHostedLoginPage({ returnTo: "/", csrfToken: "csrf-token" })).toContain("<form");
  });

  it("rejects malformed or cross-tenant operator session cookies", async () => {
    const redis = createSessionRedis();
    const sessions = new LoginSessionService(createMockConfig() as never, redis as never);

    expect(await sessions.parse("not-json.signature")).toBeNull();
    await redis.set("auth:session:tenant_a:cross-tenant-session", JSON.stringify({
      operatorId: "operator_1",
      tenantId: "other_tenant",
      expiresAt: Date.now() + 60_000
    }), 60);
    expect(await sessions.parse("cross-tenant-session")).toBeNull();
  });
});

function createSessionRedis() {
  const store = new Map<string, string>();
  return {
    set: async (key: string, value: string, _ttlSeconds?: number) => {
      store.set(key, value);
    },
    get: async (key: string) => store.get(key) ?? null,
    delete: async (key: string) => {
      store.delete(key);
    }
  };
}

async function expectErrorCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error("Expected promise to reject.");
  } catch (error) {
    expect(getErrorCode(error)).toBe(code);
  }
}
