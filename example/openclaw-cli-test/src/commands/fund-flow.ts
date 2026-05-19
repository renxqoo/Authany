import { runProtectedResourceCommand } from "./shared.js";

export async function runFundFlowCommand(input: {
  code: string;
  limit?: number;
  targetServiceUrl?: string;
}) {
  return runProtectedResourceCommand("/api/resources/fund-flow/:code", {
    targetServiceUrl: input.targetServiceUrl,
    params: { code: input.code },
    query: { limit: input.limit },
  });
}
