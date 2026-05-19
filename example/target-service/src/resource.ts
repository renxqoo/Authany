import type { TargetAccessClaims } from "@authany/sdk";
import type { TargetServiceEnv } from "./env.js";
import { isLocalClaims, type AnyAccessClaims } from "./auth.js";

export function financeSummary(env: TargetServiceEnv, claims: AnyAccessClaims) {
  if (isLocalClaims(claims)) {
    return {
      targetResource: env.targetResource,
      resource: "finance-summary",
      access: {
        decision: "allowed",
        reason: "target access token verified by target-service (local auth)",
        subject: claims.sub,
        issuer: "local",
        username: claims.username,
        audience: env.audience,
      },
      data: {
        pendingDeals: 12,
        overdueDeals: 3,
        autoReversalDeals: 2,
        todayProfitUsd: 4820.75,
        supportedActions: ["dashboard.pending.read", "dashboard.profit.read"],
      },
    };
  }

  const sdkClaims = claims as TargetAccessClaims;
  return {
    targetResource: env.targetResource,
    resource: "finance-summary",
    access: {
      decision: "allowed",
      reason: "target access token verified by target-service",
      subject: sdkClaims.sub,
      agentId: sdkClaims.agent_id,
      appId: sdkClaims.app_id,
      delegationType: sdkClaims.delegation_type ?? "unknown",
      audience: env.audience,
      externalContext: sdkClaims.external_context,
    },
    data: {
      pendingDeals: 12,
      overdueDeals: 3,
      autoReversalDeals: 2,
      todayProfitUsd: 4820.75,
      supportedActions: ["dashboard.pending.read", "dashboard.profit.read"],
    },
  };
}
