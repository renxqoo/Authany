import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { AdminAuthGuard } from "../src/shared/admin/admin-auth.guard";
import { AppConfigService } from "../src/shared/config/app-config.service";
import { HttpExceptionFilter } from "../src/shared/http/http-exception.filter";
import { getRequestContext } from "../src/shared/http/request-context";
import { createHelmetOptions } from "../src/shared/http/security-headers";
import { RedisService } from "../src/shared/redis/redis.service";
import { TokenSignerService } from "../src/shared/security/token-signer.service";
import { createMockConfig, getErrorCode } from "./test-helpers";
import { createActiveTokenStatus, createMockSecretEncryption } from "./security-test-helpers";
import { createMockPrisma } from "./test-helpers";

describe("shared infrastructure", () => {
  it("validates admin bearer tokens", async () => {
    const guard = new AdminAuthGuard(
      { baseUrl: "https://authany.test" } as never,
      { verify: vi.fn(async () => { throw new Error("invalid"); }) } as never,
      { operatorRole: { findFirst: vi.fn() } } as never,
      createActiveTokenStatus() as never,
    );

    await expect(guard.canActivate(contextWithAuth("Bearer wrong") as never)).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(contextWithAuth("") as never);
    } catch (error) {
      expect(getErrorCode(error)).toBe("invalid_admin_token");
    }
  });

  it("allows admin JWTs only when role and DB assignment are valid", async () => {
    const tokenSigner = {
      verify: vi.fn(async () => ({
        payload: {
          sub: "operator:operator_1",
          scope: "openid authany.admin",
          roles: ["platform_admin"]
        }
      }))
    };
    const prisma = {
      operatorRole: {
        findFirst: vi.fn(async () => ({ id: "role_1" }))
      }
    };
    const guard = new AdminAuthGuard(
      { baseUrl: "https://authany.test" } as never,
      tokenSigner as never,
      prisma as never,
      createActiveTokenStatus() as never,
    );

    await expect(guard.canActivate(contextWithAuth("Bearer jwt") as never)).resolves.toBe(true);
  });

  it("rejects JWTs without effective admin privilege or active DB role", async () => {
    const tokenSigner = {
      verify: vi.fn(async () => ({
        payload: {
          sub: "operator:operator_1",
          scope: "openid",
          roles: []
        }
      }))
    };
    const guard = new AdminAuthGuard(
      { baseUrl: "https://authany.test" } as never,
      tokenSigner as never,
      { operatorRole: { findFirst: vi.fn(async () => null) } } as never,
      createActiveTokenStatus() as never,
    );

    await expectErrorCode(guard.canActivate(contextWithAuth("Bearer jwt") as never), "admin_forbidden");

    tokenSigner.verify.mockResolvedValueOnce({
      payload: {
        sub: "operator:operator_1",
        scope: "openid authany.admin",
        roles: ["platform_admin"]
      }
    });

    await expectErrorCode(guard.canActivate(contextWithAuth("Bearer jwt") as never), "admin_forbidden");
  });

  it("propagates request ids and maps exceptions to HTTP payloads", () => {
    const reply = {
      header: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };

    const context = getRequestContext({ headers: { "x-request-id": "req_1" } } as never, reply as never);
    expect(context.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(reply.header).toHaveBeenCalledWith("x-request-id", context.requestId);
    expect(reply.header).toHaveBeenCalledWith("x-external-request-id", "req_1");

    new HttpExceptionFilter().catch(
      new HttpException({ code: "bad", message: "Bad request" }, 400),
      host(reply) as never,
    );
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ code: "bad", message: "Bad request" });
  });

  it("fails healthcheck when Redis is unavailable", async () => {
    const redis = new RedisService({ redisUrl: "redis://unused" } as never);

    expect(await redis.healthcheck()).toBe(false);
  });

  it("signs RS256 JWTs with the active signing key and exposes JWKS for target resources", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" }
    });
    const secrets = createMockSecretEncryption();
    const activeKeyRecord = {
      id: "key_1",
      tenantId: "tenant_a",
      kid: "kid_active",
      algorithm: "RS256",
      status: "active",
      activatedAt: new Date(),
      retiredAt: null,
      createdAt: new Date(),
      metadataJson: {
        private_key_ciphertext: secrets.encrypt(privateKey),
        public_key_pem: publicKey
      }
    };
    const prisma = createMockPrisma();
    prisma.keyRotationRecord.findFirst.mockImplementation(async ({ where }) => {
      if (where?.status === "active") {
        return activeKeyRecord;
      }
      if (where?.kid === "kid_active") {
        return activeKeyRecord;
      }
      return null;
    });
    prisma.keyRotationRecord.findMany.mockResolvedValue([activeKeyRecord]);
    const signer = new TokenSignerService(createMockConfig() as never, prisma as never, secrets);

    const signed = await signer.signWithMetadata(
      { sub: "user:user_1", agent_id: "agent_finance" },
      { audience: "https://ebfx.test", expiresInSeconds: 60 },
    );
    const verified = await signer.verify(signed.token, "https://ebfx.test");
    const jwks = await signer.getJwks();

    expect(verified.payload.sub).toBe("user:user_1");
    expect(jwks.keys[0]).toMatchObject({ alg: "RS256", kid: "kid_active", use: "sig" });
  });

  it("loads environment configuration", () => {
    const previous = { ...process.env };
    process.env.NODE_ENV = "test";
    process.env.AUTHANY_BASE_URL = "https://authany.test";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/authany";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    process.env.COOKIE_SECRET = "cookie-secret-at-least-32-bytes-ok";
    process.env.TENANT_ID = "tenant_a";
    process.env.AUTHANY_APP_SECRET_ENCRYPTION_KEY = "app-secret-at-least-32-bytes-ok-1234";
    delete process.env.AUTHANY_CSP_FORM_ACTION_ORIGINS;

    const config = new AppConfigService();

    expect(config.baseUrl).toBe("https://authany.test");
    expect(config.cspFormActionOrigins).toEqual([]);
    process.env = previous;
  });

  it("uses explicit CSP form-action origins without local defaults in production", () => {
    const previous = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.AUTHANY_BASE_URL = "https://authany.example.com";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/authany";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    process.env.COOKIE_SECRET = "cookie-secret-at-least-32-bytes-ok";
    process.env.TENANT_ID = "tenant_a";
    process.env.AUTHANY_APP_SECRET_ENCRYPTION_KEY = "app-secret-at-least-32-bytes-ok-1234";
    process.env.AUTHANY_CSP_FORM_ACTION_ORIGINS = "https://demo.example.com/callback, https://admin.example.com";

    const config = new AppConfigService();

    expect(config.cspFormActionOrigins).toEqual(["https://demo.example.com", "https://admin.example.com"]);
    process.env = previous;
  });

  it("keeps Helmet defaults while allowing configured OAuth callback origins for form actions", () => {
    const options = createHelmetOptions({
      cspFormActionOrigins: ["https://demo.example.com", "https://admin.example.com"]
    });

    expect(options.contentSecurityPolicy.directives["default-src"]).toEqual(["'self'"]);
    expect(options.contentSecurityPolicy.directives["form-action"]).toEqual([
      "'self'",
      "https://demo.example.com",
      "https://admin.example.com"
    ]);
  });
});

function contextWithAuth(authorization: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } })
    })
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

function host(reply: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, method: "GET", url: "/test" }),
      getResponse: () => reply
    })
  };
}
