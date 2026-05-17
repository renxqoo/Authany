import { mapApiError } from "@/lib/api/errors";

export class AdminV2ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function adminV2Fetch<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new AdminV2ApiError(body.message ?? view.message, response.status, body.code);
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
  queryParamField?: string;
  queryValueField?: string;
  valueKey: string;
}, queryValue?: string) {
  const search = source.queryParamField && queryValue
    ? `?${new URLSearchParams({ [source.queryParamField]: queryValue }).toString()}`
    : "";
  return normalizeRows(await adminV2Fetch(`${source.endpoint}${search}`))
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
