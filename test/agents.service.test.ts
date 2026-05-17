import { describe, expect, it, vi } from "vitest";
import { AgentsService } from "../src/modules/admin/agents/agents.service";
import { createMockConfig, createMockPrisma, getErrorCode } from "./test-helpers";

describe("AgentsService", () => {
  it("generates non-semantic Agent IDs and returns Agent management summaries", async () => {
    const { audit, prisma, service } = createService();
    prisma.agentProfile.findFirst.mockResolvedValue(null);
    prisma.agentProfile.create.mockImplementation(async ({ data }) => agentRecord(data));

    const result = await service.create({
      name: "Finance Assistant"
    });

    expect(result.agent_id).toMatch(/^agt_live_[A-Za-z0-9_-]{20,}$/);
    expect(result.agent_id).not.toContain("finance");
    expect(prisma.agentProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        agentId: expect.stringMatching(/^agt_live_/),
        name: "Finance Assistant"
      })
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "admin.agent.create" }));
  });

  it("filters list output by status and search keyword", async () => {
    const { prisma, service } = createService();
    prisma.agentProfile.findMany.mockResolvedValue([
      agentRecord({ agentId: "agt_live_finance", name: "Finance Agent" }),
      agentRecord({ agentId: "agt_live_hr", description: "People automation", name: "HR Agent" })
    ]);

    const result = await service.list({ q: "finance", status: "active" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ agent_id: "agt_live_finance", name: "Finance Agent" });
    expect(prisma.agentProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant_a", deletedAt: null, status: "active" }
    }));
  });

  it("uses an explicit include shape for list queries so removed fields cannot leak back in", async () => {
    const { prisma, service } = createService();
    prisma.agentProfile.findMany.mockResolvedValue([]);

    await service.list();

    expect(prisma.agentProfile.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant_a",
        deletedAt: null,
        status: undefined
      },
      include: {
        credentials: true,
        runtimes: {
          include: {
            connections: {
              include: { grants: true }
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });
  });

  it("updates agent details but keeps Agent ID immutable", async () => {
    const { audit, prisma, service } = createService();
    prisma.agentProfile.findFirst.mockResolvedValue(agentRecord());
    prisma.agentProfile.update.mockImplementation(async ({ data }) => agentRecord(data));

    const result = await service.update("agent_db_1", {
      name: "Finance Agent V2",
      status: "suspended"
    });

    expect(result).toMatchObject({
      agent_id: "agt_live_demo",
      name: "Finance Agent V2",
      status: "suspended"
    });
    expect(prisma.agentProfile.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ agentId: expect.any(String) })
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "admin.agent.update" }));
  });

  it("logically deletes agents after exact name confirmation and revokes active credentials", async () => {
    const { audit, prisma, service } = createService();
    prisma.agentProfile.findFirst.mockResolvedValue(agentRecord({ name: "Finance Agent" }));
    prisma.agentProfile.update.mockResolvedValue(agentRecord({ status: "deleted" }));

    await expectErrorCode(service.delete("agent_db_1", { confirm_name: "Wrong" }), "delete_confirmation_mismatch");
    await expect(service.delete("agent_db_1", { confirm_name: "Finance Agent" })).resolves.toMatchObject({
      id: "agent_db_1",
      status: "deleted"
    });
    expect(prisma.agentProfile.update).toHaveBeenCalledWith({
      where: { id: "agent_db_1" },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        status: "deleted"
      }),
      include: expect.any(Object)
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "admin.agent.delete" }));
  });

  it("rejects invalid status values", async () => {
    const { prisma, service } = createService();
    prisma.agentProfile.findFirst.mockResolvedValue(agentRecord());

    await expectErrorCode(service.update("agent_db_1", { status: "paused" }), "invalid_agent_status");
  });
});

function createService() {
  const prisma = createMockPrisma();
  const audit = { record: vi.fn(async () => undefined) };
  return {
    audit,
    prisma,
    service: new AgentsService(prisma as never, createMockConfig() as never, audit as never)
  };
}

function agentRecord(overrides: Record<string, unknown> = {}) {
  return {
    agentId: "agt_live_demo",
    auditEvents: [],
    credentials: [{
      credentialHint: "cc_live_****abcd",
      credentialType: "agent_secret",
      expiresAt: null,
      id: "cred_1",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastUsedAt: null,
      revokedAt: null,
      runtimeRegistrationId: null,
      status: "active"
    }],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    description: "Finance automation",
    id: "agent_db_1",
    name: "Finance Agent",
    runtimes: [{
      allowsDelegationRefresh: false,
      allowsRemoteCacheReuse: true,
      credentialDeliveryMode: "bearer",
      id: "runtime_1",
      runtimeId: "rt_live_cli",
      runtimeMode: "stateless",
      runtimeType: "cli",
      status: "active",
      connections: [{
        connectionId: "tc_demo",
        grants: [{ id: "grant_1", status: "active" }],
        id: "connection_1",
        status: "active",
        targetResource: "ebfx"
      }]
    }],
    status: "active",
    tenantId: "tenant_a",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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
