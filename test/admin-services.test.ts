import { describe, expect, it, vi } from "vitest";
import { TargetConnectionsService } from "../src/modules/admin/target-connections/target-connections.service";
import { AccessGrantsService } from "../src/modules/admin/access-grants/access-grants.service";
import { AdminApiModule } from "../src/modules/admin/admin.module";
import { createMockConfig, createMockPrisma, getErrorCode } from "./test-helpers";

describe("target access admin services", () => {
  it("does not expose the removed OAuth Client CRUD admin API", () => {
    const controllers = Reflect.getMetadata("controllers", AdminApiModule) as unknown[];
    expect(controllers.map((controller) => (controller as { name?: string }).name)).not.toContain("OAuthClientsController");
  });

  it("creates target connections for agent principals", async () => {
    const prisma = createMockPrisma();
    prisma.agentProfile.findFirst.mockResolvedValue({ id: "agent_db_1", agentId: "agent_demo" });
    prisma.runtimeRegistration.findFirst.mockResolvedValue({ id: "runtime_db_1", runtimeId: "runtime_demo_cli" });
    prisma.targetResourceRegistration.findFirst.mockResolvedValue({
      id: "target_db_1",
      targetResourceCode: "demo-target"
    });
    prisma.targetConnection.findFirst.mockResolvedValue(null);
    prisma.targetConnection.create.mockImplementation(async ({ data }) => ({ id: "connection_db_1", ...data }));
    const service = new TargetConnectionsService(prisma as never, createMockConfig() as never, audit(prisma) as never);

    const result = await service.create({
      principal_type: "agent",
      principal_id: "agent_demo",
      runtime_id: "runtime_demo_cli",
      target_resource: "demo-target",
      external_context_mode: "optional",
      allowed_context_providers: ["demo-web"],
      max_token_ttl_seconds: 900
    });

    expect(result).toMatchObject({
      principalType: "agent",
      principalId: "agent_demo",
      runtimeRegistrationId: "runtime_db_1",
      targetResource: "demo-target",
      status: "active"
    });
  });

  it("rejects unknown principals when creating target connections", async () => {
    const prisma = createMockPrisma();
    prisma.agentProfile.findFirst.mockResolvedValue(null);
    const service = new TargetConnectionsService(prisma as never, createMockConfig() as never, audit(prisma) as never);

    await expectErrorCode(
      service.create({
        principal_type: "agent",
        principal_id: "missing",
        target_resource: "demo-target",
        external_context_mode: "optional",
        max_token_ttl_seconds: 900
      }),
      "invalid_principal",
    );
  });

  it("creates allow grants for active target connections", async () => {
    const prisma = createMockPrisma();
    prisma.targetConnection.findFirst.mockResolvedValue({
      id: "connection_db_1",
      connectionId: "tc_demo",
      targetResource: "demo-target",
      status: "active"
    });
    prisma.accessGrant.findFirst.mockResolvedValue(null);
    prisma.accessGrant.create.mockImplementation(async ({ data }) => ({ id: "grant_db_1", ...data }));
    const service = new AccessGrantsService(prisma as never, createMockConfig() as never, audit(prisma) as never);

    await expect(service.create({
      connection_id: "tc_demo",
      grant_type: "target_access",
      effect: "allow",
      constraints: {},
      expires_at: "2026-12-31T00:00:00.000Z"
    })).resolves.toMatchObject({
      connectionId: "connection_db_1",
      effect: "allow",
      status: "active"
    });
  });
});

function audit(prisma: ReturnType<typeof createMockPrisma>) {
  return { record: vi.fn(async (input) => prisma.auditEvent.create({ data: input })) };
}

async function expectErrorCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error("Expected promise to reject.");
  } catch (error) {
    expect(getErrorCode(error)).toBe(code);
  }
}
