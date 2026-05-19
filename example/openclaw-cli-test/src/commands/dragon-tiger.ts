import { runProtectedResourceCommand } from "./shared.js";

export async function runDragonTigerCommand(input: {
  limit?: number;
  targetServiceUrl?: string;
} = {}) {
  return runProtectedResourceCommand("/api/resources/dragon-tiger", {
    targetServiceUrl: input.targetServiceUrl,
    query: { limit: input.limit },
  });
}
