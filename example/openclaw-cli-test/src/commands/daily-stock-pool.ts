import { runProtectedResourceCommand } from "./shared.js";

export async function runDailyStockPoolCommand(input: {
  tradeDate?: string;
  limit?: number;
  targetServiceUrl?: string;
} = {}) {
  return runProtectedResourceCommand("/api/resources/daily-stock-pool", {
    targetServiceUrl: input.targetServiceUrl,
    query: {
      trade_date: input.tradeDate,
      limit: input.limit,
    },
  });
}
