import { runProtectedResourceCommand } from "./shared.js";

export async function runMarketOverviewCommand(input: { targetServiceUrl?: string } = {}) {
  return runProtectedResourceCommand("/api/resources/market-overview", input);
}
