import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { decodeProtectedHeader, importPKCS8, SignJWT } from "jose";
import { KeysService } from "../src/modules/admin/keys/keys.service";
import { TargetTokenVerifierService } from "../src/modules/target-verification/target-token-verifier.service";
import { TokenSignerService } from "../src/shared/security/token-signer.service";
import { createMockConfig, createMockPrisma, getErrorCode } from "./test-helpers";
import { createMockSecretEncryption } from "./security-test-helpers";

describe("key rotation and target verification", () => {
  it("creates real RS256 key material for rotation records", async () => {
    const prisma = createMockPrisma();
    prisma.keyRotationRecord.create.mockImplementation(async ({ data }) => ({ id: "key_1", ...data }));
    const service = new KeysService(prisma as never, createMockConfig() as never, createMockSecretEncryption());

    const key = await service.create({ kid: "kid_next" });

    expect(key).toMatchObject({
      kid: "kid_next",
      algorithm: "RS256",
      status: "pending"
    });
    expect(key.metadataJson.has_private_key).toBe(true);
    expect(String(key.metadataJson.public_key_pem)).toContain("PUBLIC KEY");
  });

  it("signs with the active rotation key and still verifies historical keys from JWKS window", async () => {
    const activePair = createPair();
    const verifyingPair = createPair();
    const prisma = createMockPrisma();
    prisma.keyRotationRecord.findFirst.mockImplementation(async ({ where }) => {
      if (where.kid === "kid_old") {
        return keyRecord("kid_old", "verifying", verifyingPair);
      }
      return keyRecord("kid_active", "active", activePair);
    });
    prisma.keyRotationRecord.findMany.mockResolvedValue([
      keyRecord("kid_active", "active", activePair),
      keyRecord("kid_old", "verifying", verifyingPair)
    ]);
    const signer = new TokenSignerService(createMockConfig() as never, prisma as never, createMockSecretEncryption());

    const signed = await signer.signWithMetadata(
      { sub: "user:user_1", agent_id: "agent_finance" },
      { audience: "https://ebfx.test", expiresInSeconds: 60 },
    );

    expect(decodeProtectedHeader(signed.token).kid).toBe("kid_active");
    await expect(signer.verify(signed.token, "https://ebfx.test")).resolves.toBeTruthy();
    await expect(signer.getJwks()).resolves.toMatchObject({
      keys: expect.arrayContaining([
        expect.objectContaining({ kid: "kid_active" }),
        expect.objectContaining({ kid: "kid_old" })
      ])
    });
  });

  it("rejects unknown kid and expired retired signing keys", async () => {
    const activePair = createPair();
    const retiredPair = createPair();
    const prisma = createMockPrisma();
    prisma.keyRotationRecord.findFirst.mockImplementation(async ({ where }) => {
      if (where.kid === "kid_active") {
        return keyRecord("kid_active", "active", activePair);
      }
      if (where.kid === "kid_retired") {
        return {
          ...keyRecord("kid_retired", "retired", retiredPair),
          retiredAt: new Date(Date.now() - 2 * 3600 * 1000)
        };
      }
      return null;
    });
    const signer = new TokenSignerService({
      ...createMockConfig({ accessTokenTtlSeconds: 60, targetTokenTtlSeconds: 60 })
    } as never, prisma as never, createMockSecretEncryption());

    const unknownKidToken = await signWithKid(activePair.privateKey, "unknown_kid");
    const retiredToken = await signWithKid(retiredPair.privateKey, "kid_retired");

    await expect(signer.verify(unknownKidToken, "https://authany.test")).rejects.toThrow();
    await expect(signer.verify(retiredToken, "https://authany.test")).rejects.toThrow();
  });

  it("fails closed when no active signing key is available", async () => {
    const pendingPair = createPair();
    const prisma = createMockPrisma();
    prisma.keyRotationRecord.findFirst.mockImplementation(async ({ where }) => {
      if (where.status === "active") {
        return null;
      }
      if (where.status?.in) {
        return null;
      }
      return {
        ...keyRecord("kid_pending", "pending", pendingPair),
        activatedAt: null
      };
    });
    prisma.keyRotationRecord.findMany.mockResolvedValue([]);
    const signer = new TokenSignerService(createMockConfig() as never, prisma as never, createMockSecretEncryption());

    await expect(signer.signWithMetadata(
      { sub: "operator:operator_1" },
      { audience: "https://authany.test", expiresInSeconds: 60 },
    )).rejects.toThrow("No active signing key is available.");
    await expect(signer.getJwks()).rejects.toThrow("No usable signing keys are available.");
  });

  it("lets target resources verify audience, subject, and agent identity", async () => {
    const prisma = createMockPrisma();
    prisma.targetResourceRegistration.findFirst.mockResolvedValue({
      targetResourceCode: "ebfx",
      status: "active",
      audience: "https://ebfx.test"
    });
    const verifier = new TargetTokenVerifierService(
      prisma as never,
      {
        verify: vi.fn(async () => ({
        payload: {
          sub: "agent:agent_finance",
          agent_id: "agent_finance",
          target_resource: "ebfx",
          token_use: "target_access",
          delegation_type: "agent_as_self"
        }
      }))
      } as never,
      createMockConfig() as never,
    );

    await expect(verifier.verifyForTargetResource("jwt", "ebfx")).resolves.toMatchObject({
      active: true,
      subject: "agent:agent_finance",
      agent_id: "agent_finance",
      agent_subject: true
    });
  });

  it("rejects target verification when audience context or identity claims are invalid", async () => {
    const prisma = createMockPrisma();
    prisma.targetResourceRegistration.findFirst.mockResolvedValue(null);
    const verifier = new TargetTokenVerifierService(prisma as never, { verify: vi.fn() } as never, createMockConfig() as never);

    await expectErrorCode(verifier.verifyForTargetResource("jwt", "missing"), "invalid_target_resource");

    prisma.targetResourceRegistration.findFirst.mockResolvedValue({
      targetResourceCode: "ebfx",
      status: "active",
      audience: "https://ebfx.test"
    });
    const missingClaims = new TargetTokenVerifierService(
      prisma as never,
      { verify: vi.fn(async () => ({ payload: { sub: "user:user_1" } })) } as never,
      createMockConfig() as never,
    );
    await expectErrorCode(missingClaims.verifyForTargetResource("jwt", "ebfx"), "invalid_token");

    const requesterToken = new TargetTokenVerifierService(
      prisma as never,
      { verify: vi.fn(async () => ({ payload: { sub: "agent:agent_1", agent_id: "agent_1", token_use: "requester_assertion" } })) } as never,
      createMockConfig() as never,
    );
    await expectErrorCode(requesterToken.verifyForTargetResource("jwt", "ebfx"), "invalid_token");

    const mismatchedTarget = new TargetTokenVerifierService(
      prisma as never,
      { verify: vi.fn(async () => ({ payload: { sub: "agent:agent_1", agent_id: "agent_1", target_resource: "other-target", token_use: "target_access" } })) } as never,
      createMockConfig() as never,
    );
    await expectErrorCode(mismatchedTarget.verifyForTargetResource("jwt", "ebfx"), "invalid_token");

    const mismatchedAgentSubject = new TargetTokenVerifierService(
      prisma as never,
      { verify: vi.fn(async () => ({ payload: { sub: "agent:agent_2", agent_id: "agent_1", target_resource: "ebfx", token_use: "target_access" } })) } as never,
      createMockConfig() as never,
    );
    await expectErrorCode(mismatchedAgentSubject.verifyForTargetResource("jwt", "ebfx"), "invalid_token");

    const mismatchedAppSubject = new TargetTokenVerifierService(
      prisma as never,
      { verify: vi.fn(async () => ({ payload: { sub: "app:app_2", app_id: "app_1", target_resource: "ebfx", token_use: "target_access" } })) } as never,
      createMockConfig() as never,
    );
    await expectErrorCode(mismatchedAppSubject.verifyForTargetResource("jwt", "ebfx"), "invalid_token");
  });
});

function createPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" }
  });
}

function keyRecord(kid: string, status: string, pair: ReturnType<typeof createPair>) {
  return {
    id: kid,
    tenantId: "tenant_a",
    kid,
    algorithm: "RS256",
    status,
    activatedAt: new Date(),
    retiredAt: null,
    createdAt: new Date(),
    metadataJson: {
      private_key_ciphertext: createMockSecretEncryption().encrypt(pair.privateKey),
      public_key_pem: pair.publicKey
    }
  };
}

async function signWithKid(privateKeyPem: string, kid: string) {
  const privateKey = await importPKCS8(privateKeyPem, "RS256");
  return new SignJWT({ sub: "operator:operator_1" })
    .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
    .setIssuer("https://authany.test")
    .setAudience("https://authany.test")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

async function expectErrorCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error("Expected promise to reject.");
  } catch (error) {
    expect(getErrorCode(error)).toBe(code);
  }
}
