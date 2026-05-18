import { describe, expect, it, vi } from "vitest";
import { ApplicationsService } from "../src/modules/admin/applications/applications.service";
import { HashService } from "../src/shared/security/hash.service";
import { SecretEncryptionService } from "../src/shared/security/secret-encryption.service";
import { createMockConfig, createMockPrisma, getErrorCode } from "./test-helpers";

describe("ApplicationsService", () => {
  it("creates applications with generated App ID and encrypted revealable App Secret", async () => {
    const { audit, prisma, service } = createService();
    prisma.oAuthClient.findFirst.mockResolvedValue(null);
    prisma.oAuthClient.create.mockImplementation(async ({ data, include }) => ({
      ...record({
        clientId: data.clientId,
        description: data.description,
        name: data.name,
        redirectUris: data.redirectUris.create.map((item: { redirectUri: string }) => redirectUri(item.redirectUri)),
        secrets: [secretRecord({
          hint: data.secrets.create.hint,
          secretCiphertext: data.secrets.create.secretCiphertext,
          secretHash: data.secrets.create.secretHash
        })]
      }),
      include
    }));

    const result = await service.create({
      description: "Finance dashboard",
      name: "EBFX Dashboard",
      redirect_uris: ["https://ebfx.test/callback"]
    });

    expect(result.app_id).toMatch(/^app_live_[A-Za-z0-9_-]{20,}$/);
    expect(result.app_secret).toMatch(/^sk_live_[A-Za-z0-9_-]{40,}$/);
    expect(result.secrets[0]).toMatchObject({ revealable: true, status: "active" });
    expect(prisma.oAuthClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: expect.stringMatching(/^app_live_[A-Za-z0-9_-]{20,}$/),
        secrets: {
          create: expect.objectContaining({
            secretCiphertext: expect.any(String),
            secretHash: expect.not.stringContaining(result.app_secret)
          })
        }
      }),
      include: { redirectUris: true, secrets: true }
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "admin.application.create" }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "admin.application.secret.issue" }));
  });

  it("reveals encrypted active secrets and audits without leaking plaintext", async () => {
    const { audit, prisma, secretEncryption, service } = createService();
    const appSecret = "sk_test_secret";
    prisma.oAuthClient.findFirst.mockResolvedValue(record());
    prisma.oAuthClientSecret.findFirst.mockResolvedValue(secretRecord({
      secretCiphertext: secretEncryption.encrypt(appSecret)
    }));
    prisma.oAuthClientSecret.update.mockResolvedValue({});

    await expect(service.revealSecret("client_db_1", "secret_1")).resolves.toMatchObject({
      app_secret: appSecret
    });
    expect(prisma.oAuthClientSecret.update).toHaveBeenCalledWith({
      where: { id: "secret_1" },
      data: { viewedAt: expect.any(Date) }
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "admin.application.secret.reveal",
      payload: expect.not.objectContaining({ app_secret: appSecret })
    }));
  });

  it("rotates secrets by revoking old active secrets and returning a new revealable secret", async () => {
    const { audit, prisma, service } = createService();
    prisma.oAuthClient.findFirst.mockResolvedValue(record());
    prisma.oAuthClientSecret.create.mockImplementation(async ({ data }) => secretRecord({
      hint: data.hint,
      secretCiphertext: data.secretCiphertext,
      secretHash: data.secretHash
    }));

    const result = await service.rotateSecret("client_db_1");

    expect(result.app_secret).toMatch(/^sk_live_[A-Za-z0-9_-]{40,}$/);
    expect(prisma.oAuthClientSecret.updateMany).toHaveBeenCalledWith({
      where: { clientId: "client_db_1", status: "active" },
      data: { status: "revoked", revokedAt: expect.any(Date) }
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "admin.application.secret.rotate" }));
  });

  it("logically deletes applications only after name confirmation", async () => {
    const { audit, prisma, service } = createService();
    prisma.oAuthClient.findFirst.mockResolvedValue(record({ name: "EBFX Dashboard" }));
    prisma.oAuthClient.update.mockResolvedValue({ id: "client_db_1", status: "deleted" });

    await expectErrorCode(service.delete("client_db_1", { confirm_name: "wrong" }), "delete_confirmation_mismatch");
    await expect(service.delete("client_db_1", { confirm_name: "EBFX Dashboard" })).resolves.toMatchObject({
      id: "client_db_1",
      status: "deleted"
    });
    expect(prisma.oAuthClient.update).toHaveBeenCalledWith({
      where: { id: "client_db_1" },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        status: "deleted"
      })
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "admin.application.delete" }));
  });

  it("blocks self-lockout operations on the protected admin application", async () => {
    const { prisma, service } = createService();
    prisma.oAuthClient.findFirst.mockResolvedValue(record({
      clientId: "authany-admin-web",
      name: "AuthAny Admin Web"
    }));

    await expectErrorCode(service.rotateSecret("client_db_1"), "protected_admin_application");
    await expectErrorCode(service.delete("client_db_1", { confirm_name: "AuthAny Admin Web" }), "protected_admin_application");
    await expectErrorCode(service.update("client_db_1", { status: "inactive" }), "protected_admin_application");
    await expectErrorCode(service.update("client_db_1", { redirect_uris: ["http://127.0.0.1:3005/api/auth/callback"] }), "protected_admin_application");

    expect(prisma.oAuthClientSecret.updateMany).not.toHaveBeenCalled();
    expect(prisma.oAuthClient.update).not.toHaveBeenCalled();
  });

  it("rejects unsafe redirect URIs", async () => {
    const { prisma, service } = createService();
    prisma.oAuthClient.findFirst.mockResolvedValue(null);

    await expectErrorCode(service.create({
      name: "Unsafe App",
      redirect_uris: ["https://*.example.com/callback"]
    }), "invalid_redirect_uri");
  });
});

function createService() {
  const prisma = createMockPrisma();
  const config = createMockConfig();
  const audit = { record: vi.fn(async () => undefined) };
  const secretEncryption = new SecretEncryptionService(config as never);
  return {
    audit,
    prisma,
    secretEncryption,
    service: new ApplicationsService(
      prisma as never,
      config as never,
      new HashService(),
      secretEncryption,
      audit as never,
    )
  };
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    allowedGrantTypes: ["authorization_code", "refresh_token"],
    allowedScopes: ["openid", "profile", "offline_access"],
    clientId: "app_demo",
    clientType: "confidential",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    description: null,
    id: "client_db_1",
    name: "Demo App",
    redirectUris: [redirectUri("https://app.test/callback")],
    secrets: [secretRecord()],
    status: "active",
    tenantId: "tenant_a",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}

function redirectUri(value: string) {
  return {
    clientId: "client_db_1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "redirect_1",
    redirectUri: value,
    tenantId: "tenant_a"
  };
}

function secretRecord(overrides: Record<string, unknown> = {}) {
  return {
    clientId: "client_db_1",
    encryptionKeyId: "key_1",
    expiresAt: null,
    hint: "sk_test...cret",
    id: "secret_1",
    issuedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastUsedAt: null,
    revokedAt: null,
    secretCiphertext: "ciphertext",
    secretHash: "hash",
    status: "active",
    tenantId: "tenant_a",
    viewedAt: null,
    ...overrides
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
