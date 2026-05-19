import { runProtectedResourceCommand } from "./shared.js";

export async function runStockListCommand(input: {
  keyword?: string;
  page?: number;
  pageSize?: number;
  targetServiceUrl?: string;
} = {}) {
  return runProtectedResourceCommand("/api/resources/stock-list", {
    targetServiceUrl: input.targetServiceUrl,
    query: {
      keyword: input.keyword,
      page: input.page,
      pageSize: input.pageSize,
    },
  });
}
