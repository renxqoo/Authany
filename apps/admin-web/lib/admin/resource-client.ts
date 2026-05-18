import { mapApiError } from "@/lib/api/errors";

export class AdminResourceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function adminResourceFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const view = mapApiError(body.code);
    throw new AdminResourceApiError(body.message ?? view.message, response.status, body.code);
  }
  return response.json();
}

export function normalizeRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value as Array<Record<string, unknown>>;
  }
  return [];
}

export async function loadRemoteOptions(source: {
  endpoint: string;
  labelKeys?: string[];
  match?: Record<string, boolean | number | string>;
  queryParamField?: string;
  queryValueField?: string;
  valueKey: string;
}, queryValue?: string) {
  const search = source.queryParamField && queryValue
    ? `?${new URLSearchParams({ [source.queryParamField]: queryValue }).toString()}`
    : "";
  return normalizeRows(await adminResourceFetch(`${source.endpoint}${search}`))
    .filter((row) => matchesOptionSource(row, source.match))
    .map((row) => ({
      label: buildOptionLabel(row, source.labelKeys ?? [source.valueKey]),
      value: String(row[source.valueKey] ?? "")
    }))
    .filter((option) => option.value !== "");
}

function buildOptionLabel(row: Record<string, unknown>, labelKeys: string[]) {
  const parts = labelKeys
    .map((key) => row[key])
    .filter((value) => typeof value === "string" && value.trim() !== "");
  return parts.length > 0 ? parts.join(" / ") : "unknown";
}

function matchesOptionSource(
  row: Record<string, unknown>,
  match?: Record<string, boolean | number | string>,
) {
  if (!match) {
    return true;
  }
  return Object.entries(match).every(([key, expected]) => row[key] === expected);
}
