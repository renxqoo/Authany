import { NextResponse } from "next/server";
import { getAdminEnv } from "@/lib/server/env";
import { readAdminSession } from "@/lib/server/session";

type AdminRow = Record<string, unknown>;

type DashboardBucket = {
  active: number;
  inactive: number;
  label: string;
  other: number;
  total: number;
};

function normalizeRows(value: unknown): AdminRow[] {
  return Array.isArray(value) ? (value as AdminRow[]) : [];
}

function readStatus(row: AdminRow) {
  const status = row.status ?? row.result;
  return typeof status === "string" ? status : "";
}

function countByStatuses(rows: AdminRow[], statuses: string[]) {
  const allowed = new Set(statuses);
  return rows.filter((row) => allowed.has(readStatus(row))).length;
}

function buildBucket(label: string, rows: AdminRow[]) {
  const active = countByStatuses(rows, ["active", "ready", "ok", "verifying"]);
  const inactive = countByStatuses(rows, ["inactive", "revoked", "retired", "suspended", "deleted", "degraded", "error"]);
  return {
    label,
    total: rows.length,
    active,
    inactive,
    other: Math.max(0, rows.length - active - inactive),
  } satisfies DashboardBucket;
}

async function fetchAdminResource(sessionToken: string, path: string) {
  const response = await fetch(new URL(`/api/v1/admin/${path}`, getAdminEnv().authanyBaseUrl), {
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "content-type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  return response.json();
}

export async function GET() {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ code: "invalid_admin_token", message: "Admin session is required." }, { status: 401 });
  }

  const base = getAdminEnv().authanyBaseUrl;
  const [
    health,
    ready,
    metrics,
    applicationsRaw,
    agentsRaw,
    runtimesRaw,
    targetResourcesRaw,
    targetConnectionsRaw,
    accessGrantsRaw,
    keysRaw,
  ] = await Promise.all([
    fetch(`${base}/health`).then((item) => item.json()).catch(() => ({ status: "error" })),
    fetch(`${base}/ready`).then((item) => item.json()).catch(() => ({ status: "degraded" })),
    fetchAdminResource(session.accessToken, "metrics").catch(() => ({ alerts: [] })),
    fetchAdminResource(session.accessToken, "applications").catch(() => []),
    fetchAdminResource(session.accessToken, "agents").catch(() => []),
    fetchAdminResource(session.accessToken, "runtimes").catch(() => []),
    fetchAdminResource(session.accessToken, "target-resources").catch(() => []),
    fetchAdminResource(session.accessToken, "target-connections").catch(() => []),
    fetchAdminResource(session.accessToken, "access-grants").catch(() => []),
    fetchAdminResource(session.accessToken, "keys").catch(() => []),
  ]);

  const applications = normalizeRows(applicationsRaw);
  const agents = normalizeRows(agentsRaw);
  const runtimes = normalizeRows(runtimesRaw);
  const targetResources = normalizeRows(targetResourcesRaw);
  const targetConnections = normalizeRows(targetConnectionsRaw);
  const accessGrants = normalizeRows(accessGrantsRaw);
  const keys = normalizeRows(keysRaw);
  const alerts = Array.isArray((metrics as { alerts?: unknown[] })?.alerts) ? (metrics as { alerts: unknown[] }).alerts.length : 0;
  const healthyChecks = Object.values((ready as { checks?: Record<string, boolean> })?.checks ?? {}).filter(Boolean).length;
  const totalChecks = Object.keys((ready as { checks?: Record<string, boolean> })?.checks ?? {}).length;
  const totalSecrets = applications.reduce((sum, item) => sum + Number(item.secret_count ?? 0), 0);
  const totalAgentGrants = agents.reduce((sum, item) => sum + Number(item.grant_count ?? 0), 0);
  const totalRuntimeRegistrations = agents.reduce((sum, item) => sum + Number(item.runtime_count ?? 0), 0);
  const workingAgents = agents.filter((item) => readStatus(item) === "active" && Number(item.runtime_count ?? 0) > 0).length;

  return NextResponse.json({
    health,
    ready,
    alerts,
    totals: {
      applications: applications.length,
      activeApplications: countByStatuses(applications, ["active"]),
      agents: agents.length,
      workingAgents,
      runtimes: runtimes.length,
      activeRuntimes: countByStatuses(runtimes, ["active"]),
      targetResources: targetResources.length,
      targetConnections: targetConnections.length,
      activeTargetConnections: countByStatuses(targetConnections, ["active"]),
      accessGrants: accessGrants.length,
      activeAccessGrants: countByStatuses(accessGrants, ["active"]),
      keys: keys.length,
      activeKeys: countByStatuses(keys, ["active", "verifying"]),
      alerts,
      healthyChecks,
      totalChecks,
      totalSecrets,
      totalAgentGrants,
      totalRuntimeRegistrations,
    },
    buckets: [
      buildBucket("Applications", applications),
      buildBucket("Agents", agents),
      buildBucket("Runtimes", runtimes),
      buildBucket("Connections", targetConnections),
      buildBucket("Grants", accessGrants),
      buildBucket("Keys", keys),
    ],
  });
}
