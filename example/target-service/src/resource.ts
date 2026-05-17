import type { TargetAccessClaims } from "./auth.js";
import type { TargetServiceEnv } from "./env.js";

export function financeSummary(env: TargetServiceEnv, claims: TargetAccessClaims) {
  return {
    targetResource: env.targetResource,
    resource: "finance-summary",
    access: {
      decision: "allowed",
      reason: "target access token verified by target-service",
      subject: claims.sub,
      agentId: claims.agent_id,
      appId: claims.app_id,
      delegationType: claims.delegation_type ?? "unknown",
      audience: env.audience,
      externalContext: claims.external_context
    },
    data: {
      pendingDeals: 12,
      overdueDeals: 3,
      autoReversalDeals: 2,
      todayProfitUsd: 4820.75,
      supportedActions: ["dashboard.pending.read", "dashboard.profit.read"]
    }
  };
}
