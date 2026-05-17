import { HttpException } from "@nestjs/common";
import { vi } from "vitest";

export function createMockConfig(overrides: Record<string, unknown> = {}) {
  return {
    baseUrl: "https://authany.test",
    nodeEnv: "test",
    tenantId: "tenant_a",
    authCodeTtlSeconds: 300,
    accessTokenTtlSeconds: 3600,
    refreshTokenTtlSeconds: 2592000,
    targetTokenTtlSeconds: 900,
    targetTokenReuseThresholdSeconds: 60,
    replayTtlSeconds: 300,
    cookieSecret: "test-cookie-secret",
    appSecretEncryptionKey: "test-app-secret-encryption-key-32b",
    loginCookieName: "authany_session",
    trustedProxies: [],
    ...overrides
  };
}

export function createMockPrisma() {
  return {
    agentProfile: mockDelegate(),
    auditEvent: mockDelegate(),
    callerCredential: mockDelegate(),
    keyRotationRecord: mockDelegate(),
    oAuthAccessTokenRecord: mockDelegate(),
    oAuthAuthorizationCode: mockDelegate(),
    oAuthClient: mockDelegate(),
    oAuthClientSecret: mockDelegate(),
    oAuthRefreshToken: mockDelegate(),
    operatorAccount: mockDelegate(),
    operatorRole: mockDelegate(),
    accessGrant: mockDelegate(),
    runtimeRegistration: mockDelegate(),
    targetResourceRegistration: mockDelegate(),
    targetConnection: mockDelegate(),
    tokenRevocation: mockDelegate(),
  };
}

export function createMockTokenSigner() {
  let index = 0;
  return {
    sign: vi.fn(async () => "id.jwt"),
    signWithMetadata: vi.fn(async () => {
      index += 1;
      return {
        token: `access.jwt.${index}`,
        jti: `jti-${index}`,
        issuedAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date(Date.now() + 3600 * 1000)
      };
    }),
    verify: vi.fn(async (token: string) => ({ payload: parseMockJwt(token) })),
    getJwks: vi.fn(async () => ({ keys: [] }))
  };
}

export function createMockRequest(authorization?: string) {
  return {
    headers: authorization ? { authorization } : {},
    cookies: {}
  };
}

export function getErrorCode(error: unknown) {
  if (!(error instanceof HttpException)) {
    throw error;
  }
  const response = error.getResponse();
  return typeof response === "object" && response && "code" in response
    ? String(response.code)
    : "";
}

function mockDelegate() {
  return {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn()
  };
}

function parseMockJwt(token: string) {
  if (token.startsWith("mock:")) {
    return JSON.parse(Buffer.from(token.slice("mock:".length), "base64url").toString("utf8"));
  }
  return {
    sub: token.includes("agent") ? "agent:agent_finance" : "operator:operator_1",
    jti: token.includes("revoked") ? "revoked-jti" : "active-jti",
    aud: "https://authany.test"
  };
}

export function mockRequesterJwt(payload: Record<string, unknown>) {
  return `mock:${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}
