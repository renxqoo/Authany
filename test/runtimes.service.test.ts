import { describe, expect, it } from "vitest";
import { RuntimesService } from "../src/modules/admin/runtimes/runtimes.service";
import { createMockConfig, createMockPrisma, getErrorCode } from "./test-helpers";

describe("RuntimesService", () => {
  it("uses explicit agent selection for list queries to avoid removed-column regressions", async () => {
    const prisma = createMockPrisma();
    prisma.runtimeRegistration.findMany.mockResolvedValue([]);
    const service = new RuntimesService(prisma as never, createMockConfig() as never);

    await service.list();

    expect(prisma.runtimeRegistration.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant_a",
        agent: undefined
      },
      include: {
        agent: {
          select: {
            id: true,
            tenantId: true,
            agentId: true,
            name: true,
            status: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  });

  it("uses explicit agent selection for detail queries to avoid removed-column regressions", async () => {
    const prisma = createMockPrisma();
    prisma.runtimeRegistration.findFirst.mockResolvedValue({
      id: "runtime_db_1"
    });
    const service = new RuntimesService(prisma as never, createMockConfig() as never);

    await service.get("runtime_db_1");

    expect(prisma.runtimeRegistration.findFirst).toHaveBeenCalledWith({
      where: {
        id: "runtime_db_1",
        tenantId: "tenant_a"
      },
      include: {
        agent: {
          select: {
            id: true,
            tenantId: true,
            agentId: true,
            name: true,
            status: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true
          }
        },
        connections: {
          include: {
            grants: true,
            target: true
          }
        },
        credentials: true
      }
    });
  });

  it("generates non-semantic Runtime IDs when creating runtime registrations", async () => {
    const prisma = createMockPrisma();
    prisma.agentProfile.findFirst.mockResolvedValue({ id: "agent_db_1", agentId: "agt_live_demo" });
    prisma.runtimeRegistration.findFirst.mockResolvedValue(null);
    prisma.runtimeRegistration.create.mockImplementation(async ({ data }) => ({
      id: "runtime_db_1",
      ...data
    }));
    const service = new RuntimesService(prisma as never, createMockConfig() as never);

    const result = await service.create({
      agent_id: "agt_live_demo",
      runtime_type: "cli",
      runtime_mode: "stateless"
    });

    expect(result.runtimeId).toMatch(/^rt_live_[A-Za-z0-9_-]{20,}$/);
    expect(result.runtimeId).not.toContain("cli");
    expect(prisma.runtimeRegistration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        runtimeId: expect.stringMatching(/^rt_live_/),
        agentId: "agent_db_1",
        runtimeType: "cli",
        runtimeMode: "stateless"
      })
    }));
  });

  it("rejects delegation refresh for stateless runtimes", async () => {
    const prisma = createMockPrisma();
    const service = new RuntimesService(prisma as never, createMockConfig() as never);

    await expectErrorCode(service.create({
      agent_id: "agt_live_demo",
      runtime_type: "cli",
      runtime_mode: "stateless",
      allows_delegation_refresh: true
    }), "invalid_runtime_refresh_policy");
  });
});

async function expectErrorCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error("Expected promise to reject.");
  } catch (error) {
    expect(getErrorCode(error)).toBe(code);
  }
}
