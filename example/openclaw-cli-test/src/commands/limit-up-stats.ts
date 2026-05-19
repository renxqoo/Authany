import { runProtectedResourceCommand } from "./shared.js";

export async function runLimitUpStatsCommand(input: {
  limit?: number;
  targetServiceUrl?: string;
} = {}) {
  return runProtectedResourceCommand("/api/resources/limit-up-stats", {
    targetServiceUrl: input.targetServiceUrl,
    query: { limit: input.limit },
  });
}
