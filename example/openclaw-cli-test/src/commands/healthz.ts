import { runPublicResourceCommand } from "./shared.js";

export async function runHealthzCommand(input: { targetServiceUrl?: string } = {}) {
  return runPublicResourceCommand("/healthz", input);
}
