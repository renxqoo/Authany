import { runProtectedResourceCommand } from "./shared.js";

export async function runConceptListCommand(input: {
  page?: number;
  pageSize?: number;
  targetServiceUrl?: string;
} = {}) {
  return runProtectedResourceCommand("/api/resources/concept-list", {
    targetServiceUrl: input.targetServiceUrl,
    query: {
      page: input.page,
      pageSize: input.pageSize,
    },
  });
}
