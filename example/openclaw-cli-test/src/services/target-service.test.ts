import { describe, expect, it, vi } from "vitest";
import {
  fetchFinanceSummary,
  fetchPublicTargetServiceResource,
  resolveFinanceSummaryUrl,
  resolveTargetServiceUrl,
} from "./target-service.js";

describe("target-service access", () => {
  it("builds the finance-summary endpoint URL", () => {
    expect(resolveFinanceSummaryUrl("http://127.0.0.1:3006")).toBe(
      "http://127.0.0.1:3006/api/resources/finance-summary",
    );
  });

  it("builds arbitrary target-service URLs with query params", () => {
    expect(
      resolveTargetServiceUrl("http://127.0.0.1:3006", "/api/resources/stock-list", {
        keyword: "平安",
        page: 2,
        pageSize: 10,
      }),
    ).toBe(
      "http://127.0.0.1:3006/api/resources/stock-list?keyword=%E5%B9%B3%E5%AE%89&page=2&pageSize=10",
    );
  });

  it("uses an injected target token when present", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      status: 200,
      json: async () => ({
        resource: "finance-summary",
        targetResource: "demo-target"
      })
    } as Response);

    const result = await fetchFinanceSummary(
      {
        injectedTargetAccessToken: "jwt_demo",
        targetServiceUrl: "http://127.0.0.1:3006"
      },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3006/api/resources/finance-summary",
      {
        headers: {
          accept: "application/json",
          authorization: "Bearer jwt_demo"
        }
      },
    );
    expect(result.mode).toBe("injected_target_token");
    expect(result.status).toBe(200);
  });

  it("fails fast when a protected route has no injected target token", async () => {
    await expect(
      fetchFinanceSummary({
        targetServiceUrl: "http://127.0.0.1:3006"
      }),
    ).rejects.toThrow(
      "AUTHANY_TARGET_ACCESS_TOKEN is required for protected authany-stock commands.",
    );
  });

  it("supports public routes without a bearer token", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      status: 200,
      json: async () => ({
        status: "ok"
      })
    } as Response);

    const result = await fetchPublicTargetServiceResource(
      "http://127.0.0.1:3006",
      "/healthz",
      undefined,
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:3006/healthz", {
      headers: {
        accept: "application/json"
      }
    });
    expect(result.mode).toBe("public");
    expect(result.status).toBe(200);
  });
});
