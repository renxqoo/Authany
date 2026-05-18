import { describe, expect, it, vi } from "vitest";
import { AuditService } from "../src/shared/audit/audit.service";
import { RateLimitService } from "../src/shared/rate-limit/rate-limit.service";
import { createMockConfig, createMockPrisma, getErrorCode } from "./test-helpers";

describe("rate limiting and audit", () => {
  it("blocks requests after the configured window limit", async () => {
    let count = 0;
    const metrics = {
      increment: vi.fn(),
      alert: vi.fn()
    };
    const limiter = new RateLimitService(metrics as never, {
      increment: async () => {
        count += 1;
        return count;
      }
    } as never);

    await limiter.assertAllowed({
      key: "oauth:token:web",
      limit: 1,
      windowSeconds: 60,
      metricName: "oauth.token.rate_limit"
    });

    try {
      await limiter.assertAllowed({
        key: "oauth:token:web",
        limit: 1,
        windowSeconds: 60,
        metricName: "oauth.token.rate_limit"
      });
      throw new Error("Expected rate limit to throw.");
    } catch (error) {
      expect(getErrorCode(error)).toBe("rate_limited");
    }
    expect(metrics.increment).toHaveBeenCalledWith("oauth.token.rate_limit", { result: "limited" });
    expect(metrics.alert).toHaveBeenCalledWith(expect.objectContaining({
      type: "rate_limit.exceeded",
      severity: "warning"
    }));
  });

  it("persists audit events with tenant and sanitized optional fields", async () => {
    const prisma = createMockPrisma();
    prisma.auditEvent.create.mockResolvedValue({});
    const audit = new AuditService(prisma as never, createMockConfig() as never);

    await audit.record({
      eventType: "target_token.issue",
      result: "success",
      operatorId: "operator_1",
      agentId: "agent_db_1",
      targetResource: "ebfx",
      payload: { safe: true }
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant_a",
        eventType: "target_token.issue",
        result: "success",
        requestId: undefined,
        operatorId: "operator_1",
        clientId: undefined,
        agentId: "agent_db_1",
        targetResource: "ebfx",
        errorCode: undefined,
        payloadJson: { safe: true }
      }
    });
  });
});
