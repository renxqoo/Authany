import { describe, expect, it, vi } from "vitest";
import { HashService } from "../src/shared/security/hash.service";
import { LoginSessionService } from "../src/shared/security/login-session.service";
import { MetricsService } from "../src/shared/metrics/metrics.service";
import { KeysService } from "../src/modules/admin/keys/keys.service";
import { CallerCredentialsService } from "../src/modules/admin/caller-credentials/caller-credentials.service";
import { createMockConfig, createMockPrisma } from "./test-helpers";
import { createMockSecretEncryption } from "./security-test-helpers";

describe("admin and platform services", () => {
  it("creates caller credentials with one-time plaintext and stores only a hash", async () => {
    const prisma = createMockPrisma();
    prisma.agentProfile.findFirst.mockResolvedValue({ id: "agent_db_1" });
    prisma.callerCredential.create.mockImplementation(async ({ data }) => ({ id: "cred_1", ...data }));

    const service = new CallerCredentialsService(
      prisma as never,
      createMockConfig() as never,
      new HashService(),
      { record: vi.fn() } as never,
    );

    const result = await service.createForAgent("agent_db_1", {});

    expect(result.caller_credential).toMatch(/^cc_live_/);
    expect(result.credential.secretHashOrPublicKeyRef).not.toBe(result.caller_credential);
  });

  it("records key rotation lifecycle states", async () => {
    const prisma = createMockPrisma();
    const service = new KeysService(prisma as never, createMockConfig() as never, createMockSecretEncryption());
    prisma.keyRotationRecord.create.mockImplementation(async ({ data }) => ({ id: "key_1", ...data }));
    prisma.keyRotationRecord.findFirst.mockResolvedValue({ id: "key_1", tenantId: "tenant_a" });
    prisma.keyRotationRecord.updateMany.mockResolvedValue({ count: 1 });
    prisma.keyRotationRecord.update.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));

    await expect(service.create({ kid: "kid_next" })).resolves.toMatchObject({
      kid: "kid_next",
      algorithm: "RS256",
      status: "pending"
    });
    await expect(service.activate("key_1")).resolves.toMatchObject({
      id: "key_1",
      status: "active",
      activatedAt: expect.any(Date)
    });
    await expect(service.retire("key_1")).resolves.toMatchObject({
      id: "key_1",
      status: "retired",
      retiredAt: expect.any(Date)
    });
  });

  it("keeps metrics counters and alert snapshots observable", () => {
    const metrics = new MetricsService();

    metrics.increment("delegation.exchange", { result: "success", target_resource: "ebfx" });
    metrics.alert({
      type: "redis.degraded",
      severity: "warning",
      message: "Redis fallback is active."
    });

    expect(metrics.snapshot()).toMatchObject({
      counters: [{
        name: "delegation.exchange",
        tags: { result: "success", target_resource: "ebfx" },
        value: 1
      }],
      alerts: [{
        type: "redis.degraded",
        severity: "warning"
      }]
    });
  });

  it("creates server-backed login sessions and rejects tampering", async () => {
    const store = new Map<string, string>();
    const redis = {
      set: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      delete: vi.fn(async (key: string) => { store.delete(key); })
    };
    const sessions = new LoginSessionService(createMockConfig() as never, redis as never);
    const cookie = await sessions.create("operator_1");
    const tampered = `${cookie.slice(0, -1)}x`;

    expect(await sessions.parse(cookie)).toMatchObject({ operatorId: "operator_1" });
    expect(await sessions.parse(tampered)).toBeNull();
  });

  it("revokes caller credentials by state transition instead of deletion", async () => {
    const prisma = createMockPrisma();
    prisma.callerCredential.findFirst.mockResolvedValue({ id: "cred_1", agentId: "agent_db_1" });
    prisma.callerCredential.update.mockResolvedValue({ id: "cred_1", status: "revoked" });
    const service = new CallerCredentialsService(
      prisma as never,
      createMockConfig() as never,
      { hashSecret: vi.fn(), verifySecret: vi.fn() } as never,
      { record: vi.fn() } as never,
    );

    await expect(service.revoke("cred_1")).resolves.toMatchObject({ status: "revoked" });
    expect(prisma.callerCredential.findFirst).toHaveBeenCalledWith({
      where: { id: "cred_1", tenantId: "tenant_a" }
    });
    expect(prisma.callerCredential.update).toHaveBeenCalledWith({
      where: { id: "cred_1" },
      data: { status: "revoked", revokedAt: expect.any(Date) }
    });
  });
});
