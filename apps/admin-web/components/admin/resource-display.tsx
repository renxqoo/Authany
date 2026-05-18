import type React from "react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ValueKind } from "@/lib/admin/types";
import type { I18nTranslator } from "@/lib/i18n/translate";

function isHiddenJsonValue(value: unknown): value is { configured: false; reason?: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "configured" in value &&
    (value as { configured?: unknown }).configured === false,
  );
}

export function renderResourceValue(
  value: unknown,
  kind: ValueKind = "text",
  t?: I18nTranslator,
): React.ReactNode {
  if (kind === "status") {
    return <StatusBadge status={typeof value === "string" ? value : "unknown"} />;
  }
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-400">-</span>;
  }
  if (kind === "mono") {
    return <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{String(value)}</code>;
  }
  if (kind === "multiline") {
    return (
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-700">
        {String(value)}
      </pre>
    );
  }
  if (kind === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }
  if (kind === "boolean") {
    return (
      <Badge tone={value ? "green" : "slate"}>
        {value
          ? t?.("common.yes", undefined, "Yes") ?? "Yes"
          : t?.("common.no", undefined, "No") ?? "No"}
      </Badge>
    );
  }
  if (kind === "json") {
    if (isHiddenJsonValue(value)) {
      const reason = typeof value.reason === "string"
        ? value.reason
        : t?.("resource.hiddenJson", undefined, "This JSON value is intentionally hidden.")
          ?? "This JSON value is intentionally hidden.";
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
          {reason}
        </div>
      );
    }
    return (
      <pre className="max-h-64 overflow-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  if (kind === "string-array" && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((item) => <Badge key={String(item)}>{String(item)}</Badge>)}
      </div>
    );
  }
  if (kind === "count") {
    return <span className="font-semibold text-slate-900">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? <span className="text-slate-400">-</span> : value.map(String).join(", ");
  }
  if (typeof value === "object") {
    return (
      <pre className="max-h-40 overflow-auto rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return String(value);
}

export function readValue(
  record: Record<string, unknown>,
  definition: { getValue?: (record: Record<string, unknown>) => unknown; key?: string },
) {
  if (definition.getValue) {
    return definition.getValue(record);
  }
  return definition.key ? record[definition.key] : undefined;
}
