import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { HashService } from "../src/shared/security/hash.service";
import { PkceService } from "../src/modules/oidc/pkce.service";
import { OidcService } from "../src/modules/oidc/oidc.service";
import { createMockConfig, createMockPrisma, createMockTokenSigner, getErrorCode } from "./test-helpers";
import { createActiveTokenStatus } from "./security-test-helpers";

describe("OidcService", () => {
  const hashes = new HashService();
  let prisma: ReturnType<typeof createMockPrisma>;
  let tokenSigner: ReturnType<typeof createMockTokenSigner>;
  let service: OidcService;
  let clientSecretHash: string;

  beforeEach(() => {
    prisma = createMockPrisma();
    tokenSigner = createMockTokenSigner();
    prisma.operatorRole.findMany.mockResolvedValue([]);
    clientSecretHash = hashes.hashSecret("client-secret");
    service = new OidcService(
      prisma as never,
      createMockConfig() as never,
      tokenSigner as never,
      hashes,
      { resolveOperatorId: vi.fn(async () => "operator_1") } as never,
      new PkceService(),
      { increment: vi.fn() } as never,
      { record: vi.fn() } as never,
      { assertAllowed: vi.fn() } as never,
      createActiveTokenStatus() as never,
    );
  });

  it("rotates refresh tokens and rejects the old token on reuse", async () => {
    prisma.oAuthClient.findFirst.mockResolvedValue(activeClient(clientSecretHash));
    prisma.oAuthRefreshToken.findUnique.mockResolvedValue({
      id: "refresh_db_1",
      jti: "refresh-jti-1",
      status: "active",
      clientId: "client_db_1",
      operatorId: "operator_1",
      scope: "openid offline_access",
      expiresAt: new Date(Date.now() + 60_000)
    });
    prisma.oAuthRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.oAuthAccessTokenRecord.create.mockResolvedValue({});
    prisma.oAuthRefreshToken.create.mockResolvedValue({});
    prisma.auditEvent.create.mockResolvedValue({});

    const result = await service.exchangeRefreshToken({
      clientId: "web",
      clientSecret: "client-secret",
      refreshToken: "refresh-token"
    });

    expect(result.refresh_token).toBeTruthy();
    expect(prisma.oAuthRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: "refresh_db_1", status: "active" },
      data: { status: "rotated", revokedAt: expect.any(Date) }
    });

    prisma.oAuthRefreshToken.findUnique.mockResolvedValueOnce({
      status: "rotated",
      clientId: "client_db_1",
      expiresAt: new Date(Date.now() + 60_000)
    });

    await expectErrorCode(service.exchangeRefreshToken({
      clientId: "web",
      clientSecret: "client-secret",
      refreshToken: "refresh-token"
    }), "invalid_grant");
  });

  it("revokes refresh tokens idempotently without deleting token records", async () => {
    prisma.oAuthRefreshToken.findUnique.mockResolvedValue({
      id: "refresh_db_1",
      jti: "refresh-jti-1",
      clientId: "client_db_1"
    });
    prisma.oAuthClient.findFirst.mockResolvedValue(activeClient(clientSecretHash));
    prisma.tokenRevocation.upsert.mockResolvedValue({});
    prisma.oAuthRefreshToken.update.mockResolvedValue({});
    prisma.auditEvent.create.mockResolvedValue({});

    await expect(service.revokeToken({
      token: "refresh-token",
      tokenTypeHint: "refresh_token",
      clientId: "web",
      clientSecret: "client-secret"
    })).resolves.toEqual({});

    expect(prisma.tokenRevocation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenJti_tokenType: { tokenJti: "refresh-jti-1", tokenType: "refresh_token" } }
    }));
    expect(prisma.oAuthRefreshToken.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "revoked" })
    }));
  });

  it("revokes JWT access tokens by jti and introspection returns inactive", async () => {
    const jwt = [
      "eyJhbGciOiJSUzI1NiIsImtpZCI6ImtpZCJ9",
      Buffer.from(JSON.stringify({ jti: "access-jti-1" })).toString("base64url"),
      "signature"
    ].join(".");
    prisma.oAuthRefreshToken.findUnique.mockResolvedValue(null);
    prisma.oAuthClient.findFirst.mockResolvedValue(activeClient(clientSecretHash));
    prisma.oAuthAccessTokenRecord.findUnique.mockResolvedValue({
      jti: "access-jti-1",
      clientId: "client_db_1",
      expiresAt: new Date(Date.now() + 60_000)
    });
    prisma.tokenRevocation.upsert.mockResolvedValue({});
    prisma.auditEvent.create.mockResolvedValue({});

    await service.revokeToken({
      token: jwt,
      tokenTypeHint: "access_token",
      clientId: "web",
      clientSecret: "client-secret"
    });

    expect(prisma.tokenRevocation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenJti_tokenType: { tokenJti: "access-jti-1", tokenType: "access_token" } }
    }));

    tokenSigner.verify.mockResolvedValueOnce({ payload: { jti: "revoked-jti", sub: "operator:operator_1" } });
    prisma.oAuthAccessTokenRecord.findUnique.mockResolvedValue({
      jti: "revoked-jti",
      clientId: "client_db_1",
      expiresAt: new Date(Date.now() + 60_000)
    });
    prisma.tokenRevocation.findFirst.mockResolvedValue({ tokenJti: "revoked-jti" });

    await expect(service.introspectToken({
      token: "revoked.jwt",
      clientId: "web",
      clientSecret: "client-secret"
    })).resolves.toMatchObject({ active: false });
  });

  it("rejects expired OAuth client secrets", async () => {
    prisma.oAuthClient.findFirst.mockResolvedValue(activeClient(
      clientSecretHash,
      new Date(Date.now() - 1000),
    ));

    await expectErrorCode(service.exchangeClientCredentials({
      clientId: "web",
      clientSecret: "client-secret"
    }), "invalid_client");
  });

  it("builds consent details only for registered redirect URIs and allowed scopes", async () => {
    prisma.oAuthClient.findFirst.mockResolvedValue(activeAuthorizeClient(["openid", "profile"]));

    await expect(service.getConsentDetails({
      responseType: "code",
      clientId: "web",
      redirectUri: "http://127.0.0.1:5173/callback",
      scope: "openid profile",
      state: "state",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256"
    })).resolves.toMatchObject({
      clientId: "web",
      clientName: "Web App",
      scopeItems: ["openid", "profile"]
    });

    await expectErrorCode(service.getConsentDetails({
      responseType: "code",
      clientId: "web",
      redirectUri: "http://127.0.0.1:5173/callback",
      scope: "openid repo",
      state: "state",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256"
    }), "invalid_scope");
  });

  it("returns OAuth access_denied redirects for denied consent", async () => {
    prisma.oAuthClient.findFirst.mockResolvedValue(activeAuthorizeClient(["openid"]));

    await expect(service.createAccessDeniedRedirect({
      clientId: "web",
      redirectUri: "http://127.0.0.1:5173/callback",
      state: "state"
    })).resolves.toContain("error=access_denied");
  });

  it("does not leak admin roles to ordinary OAuth clients", async () => {
    prisma.oAuthClient.findFirst.mockResolvedValue(activeClient(clientSecretHash, null, ["openid", "profile", "offline_access"]));
    prisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
      id: "code_db_1",
      status: "active",
      clientId: "client_db_1",
      operatorId: "operator_1",
      redirectUri: "http://127.0.0.1:5173/callback",
      scope: "openid profile offline_access",
      codeChallenge: createHash("sha256").update("verifier").digest("base64url"),
      codeChallengeMethod: "S256",
      expiresAt: new Date(Date.now() + 60_000)
    });
    prisma.operatorRole.findMany.mockResolvedValue([{ roleCode: "platform_admin", scope: "authany.admin" }]);
    prisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.oAuthAccessTokenRecord.create.mockResolvedValue({});
    prisma.oAuthRefreshToken.create.mockResolvedValue({});
    prisma.auditEvent.create.mockResolvedValue({});

    await service.exchangeAuthorizationCode({
      clientId: "web",
      clientSecret: "client-secret",
      code: "code",
      redirectUri: "http://127.0.0.1:5173/callback",
      codeVerifier: "verifier"
    });

    expect(tokenSigner.signWithMetadata).toHaveBeenCalledWith(expect.objectContaining({
      scope: "openid profile offline_access",
      roles: []
    }), expect.any(Object));
  });
});

function activeClient(secretHash: string, expiresAt: Date | null = null, allowedScopes: string[] = ["openid", "profile"]) {
  return {
    id: "client_db_1",
    clientId: "web",
    allowedGrantTypes: ["authorization_code", "refresh_token", "client_credentials"],
    allowedScopes,
    secrets: [{
      status: "active",
      secretHash,
      expiresAt
    }]
  };
}

function activeAuthorizeClient(allowedScopes: string[]) {
  return {
    id: "client_db_1",
    clientId: "web",
    name: "Web App",
    allowedGrantTypes: ["authorization_code"],
    allowedScopes,
    redirectUris: [{
      redirectUri: "http://127.0.0.1:5173/callback"
    }]
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
