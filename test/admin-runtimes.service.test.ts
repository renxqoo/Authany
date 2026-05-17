import { describe, expect, it } from "vitest";
import { RuntimesService } from "../src/modules/admin/runtimes/runtimes.service";
import { createMockConfig, createMockPrisma } from "./test-helpers";

describe("admin runtimes service", () => {
  it("creates runtimes with platform-generated runtime IDs", async () => {
    const prisma = createMockPrisma();
    prisma.agentProfile.findFirst.mockResolvedValue({ id: "agent_db_1", agentId: "agt_live_demo" });
    prisma.runtimeRegistration.findFirst.mockResolvedValue(null);
    prisma.runtimeRegistration.create.mockImplementation(async ({ data }) => ({ id: "runtime_db_1", ...data }));
    const service = new RuntimesService(prisma as never, createMockConfig() as never);

    const result = await service.create({
      agent_id: "agt_live_demo",
      runtime_type: "worker",
      runtime_mode: "stateless"
    });

    expect(result).toMatchObject({
      agentId: "agent_db_1",
      runtimeType: "worker",
      runtimeMode: "stateless",
      status: "active"
    });
    expect(result.runtimeId).toMatch(/^rt_live_[A-Za-z0-9_-]{20,}$/);
  });
});
