import { Badge } from "./badge";

export function StatusBadge({ status }: { status?: string }) {
  const tone = status === "active" || status === "ready" || status === "ok"
    ? "green"
    : status === "revoked" || status === "inactive" || status === "degraded"
      ? "red"
      : status === "pending" || status === "suspended"
        ? "amber"
        : "slate";

  return <Badge tone={tone}>{status ?? "unknown"}</Badge>;
}
