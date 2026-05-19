import { runProtectedResourceCommand } from "./shared.js";

export async function runIndexDailyCommand(input: {
  limit?: number;
  targetServiceUrl?: string;
} = {}) {
  return runProtectedResourceCommand("/api/resources/index-daily", {
    targetServiceUrl: input.targetServiceUrl,
    query: { limit: input.limit },
  });
}
