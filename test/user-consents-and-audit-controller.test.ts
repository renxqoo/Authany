import { describe, expect, it } from "vitest";
import { AuditEventsController } from "../src/modules/admin/audit-events/audit-events.controller";
import { createMockPrisma } from "./test-helpers";

describe("audit event controller", () => {
  it("filters audit events by operator, agent, target, and time window", async () => {
    const prisma = createMockPrisma();
    prisma.auditEvent.findMany.mockResolvedValue([{ id: "audit_1" }]);
    const controller = new AuditEventsController(prisma as never, { tenantId: "tenant_a" } as never);

    await expect(controller.list({
      event_type: " target_token.issue ",
      operator_id: " operator_1 ",
      agent_id: " agent_db_1 ",
      target_resource: " demo-target ",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.999Z"
    })).resolves.toEqual([{ id: "audit_1" }]);
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant_a",
        eventType: "target_token.issue",
        operatorId: "operator_1",
        agentId: "agent_db_1",
        targetResource: "demo-target",
        occurredAt: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lte: new Date("2026-01-31T23:59:59.999Z")
        }
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
      skip: 0,
      cursor: undefined
    });
  });
});
