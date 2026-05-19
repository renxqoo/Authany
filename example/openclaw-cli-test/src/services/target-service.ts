import { resolveTargetAccessToken } from "./authany.js";
import type { CliEnv, TargetServiceResult } from "../types.js";

export async function fetchFinanceSummary(
  env: CliEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<TargetServiceResult> {
  return fetchProtectedTargetServiceResource(
    env,
    "/api/resources/finance-summary",
    undefined,
    fetchImpl,
  );
}

export function resolveFinanceSummaryUrl(targetServiceUrl: string) {
  return new URL("/api/resources/finance-summary", withTrailingSlash(targetServiceUrl)).toString();
}

export async function fetchProtectedTargetServiceResource(
  env: CliEnv,
  path: string,
  query?: Record<string, string | number | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<TargetServiceResult> {
  const token = await resolveTargetAccessToken(env);
  const response = await fetchImpl(resolveTargetServiceUrl(env.targetServiceUrl, path, query), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token.accessToken}`
    }
  });
  const body = await response.json().catch(() => ({}));

  return {
    mode: token.mode,
    response: body as Record<string, unknown>,
    status: response.status,
    targetServiceUrl: env.targetServiceUrl
  };
}

export async function fetchPublicTargetServiceResource(
  targetServiceUrl: string,
  path: string,
  query?: Record<string, string | number | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<TargetServiceResult> {
  const response = await fetchImpl(resolveTargetServiceUrl(targetServiceUrl, path, query), {
    headers: {
      accept: "application/json"
    }
  });
  const body = await response.json().catch(() => ({}));

  return {
    mode: "public",
    response: body as Record<string, unknown>,
    status: response.status,
    targetServiceUrl
  };
}

export function resolveTargetServiceUrl(
  targetServiceUrl: string,
  path: string,
  query?: Record<string, string | number | undefined>,
) {
  const url = new URL(path, withTrailingSlash(targetServiceUrl));
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
