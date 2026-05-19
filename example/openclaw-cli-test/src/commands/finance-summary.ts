import { runProtectedResourceCommand } from "./shared.js";

export async function runFinanceSummaryCommand(input: { targetServiceUrl?: string } = {}) {
  return runProtectedResourceCommand("/api/resources/finance-summary", input);
}
