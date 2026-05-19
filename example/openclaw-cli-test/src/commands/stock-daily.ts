import { runProtectedResourceCommand } from "./shared.js";

export async function runStockDailyCommand(input: {
  code: string;
  limit?: number;
  targetServiceUrl?: string;
}) {
  return runProtectedResourceCommand("/api/resources/stock-daily/:code", {
    targetServiceUrl: input.targetServiceUrl,
    params: { code: input.code },
    query: { limit: input.limit },
  });
}
