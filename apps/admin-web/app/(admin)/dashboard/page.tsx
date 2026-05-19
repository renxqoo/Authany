"use client";

import { Activity, AppWindow, Bot, Cable, KeyRound, Layers3, Waypoints } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminHero, AdminMetric, AdminPageShell } from "@/components/admin/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/components/i18n/language-provider";

type DashboardBucket = {
  active: number;
  inactive: number;
  label: string;
  other: number;
  total: number;
};

type DashboardData = {
  alerts: number;
  buckets: DashboardBucket[];
  health?: { status?: string };
  ready?: { checks?: Record<string, boolean>; status?: string };
  totals: {
    accessGrants: number;
    activeAccessGrants: number;
    activeApplications: number;
    activeKeys: number;
    activeRuntimes: number;
    activeTargetConnections: number;
    agents: number;
    alerts: number;
    applications: number;
    healthyChecks: number;
    keys: number;
    runtimes: number;
    targetConnections: number;
    targetResources: number;
    totalAgentGrants: number;
    totalChecks: number;
    totalRuntimeRegistrations: number;
    totalSecrets: number;
    workingAgents: number;
  };
};

export default function DashboardPage() {
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    void fetch("/api/ops/dashboard").then((item) => item.json()).then(setDashboard);
  }, []);

  const composition = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    return [
      { color: "#2563eb", label: t("dashboard.applications"), value: dashboard.totals.applications },
      { color: "#0f766e", label: t("dashboard.workingAgents"), value: dashboard.totals.workingAgents },
      { color: "#0891b2", label: t("dashboard.runtimes"), value: dashboard.totals.runtimes },
      { color: "#7c3aed", label: t("dashboard.targetConnections"), value: dashboard.totals.targetConnections },
      { color: "#ea580c", label: t("dashboard.activeGrants"), value: dashboard.totals.activeAccessGrants },
      { color: "#ca8a04", label: t("dashboard.activeKeys"), value: dashboard.totals.activeKeys },
    ].filter((item) => item.value > 0);
  }, [dashboard, t]);

  if (!dashboard) {
    return <Skeleton className="h-[38rem]" />;
  }

  const checks = dashboard.ready?.checks ?? {};

  return (
    <AdminPageShell>
      <AdminHero description={t("dashboard.description")} eyebrow={t("dashboard.overview")} size="feature" title={t("dashboard.title")}>
        <AdminMetric label={t("dashboard.appHealth")} size="feature" value={<StatusBadge status={dashboard.health?.status ?? t("common.unknown")} />} />
        <AdminMetric label={t("dashboard.readiness")} size="feature" value={<StatusBadge status={dashboard.ready?.status ?? t("common.unknown")} />} />
        <AdminMetric label={t("dashboard.workingAgents")} size="feature" value={String(dashboard.totals.workingAgents)} />
        <AdminMetric label={t("dashboard.applications")} size="feature" value={String(dashboard.totals.applications)} />
      </AdminHero>

      <section className="grid gap-4 xl:grid-cols-3">
        <StatCard
          icon={AppWindow}
          label={t("dashboard.applications")}
          note={t("dashboard.applicationsNote")}
          value={dashboard.totals.applications}
          accent="blue"
          subvalue={`${dashboard.totals.activeApplications} ${t("dashboard.activeCount")}`}
        />
        <StatCard
          icon={Bot}
          label={t("dashboard.workingAgents")}
          note={t("dashboard.workingAgentsNote")}
          value={dashboard.totals.workingAgents}
          accent="emerald"
          subvalue={`${dashboard.totals.agents} ${t("dashboard.totalAgents")}`}
        />
        <StatCard
          icon={Layers3}
          label={t("dashboard.runtimes")}
          note={t("dashboard.runtimesNote")}
          value={dashboard.totals.activeRuntimes}
          accent="cyan"
          subvalue={`${dashboard.totals.runtimes} ${t("dashboard.totalRuntimeRegistrations")}`}
        />
        <StatCard
          icon={Cable}
          label={t("dashboard.targetConnections")}
          note={t("dashboard.targetConnectionsNote")}
          value={dashboard.totals.activeTargetConnections}
          accent="violet"
          subvalue={`${dashboard.totals.targetConnections} ${t("dashboard.totalConnections")}`}
        />
        <StatCard
          icon={Waypoints}
          label={t("dashboard.activeGrants")}
          note={t("dashboard.activeGrantsNote")}
          value={dashboard.totals.activeAccessGrants}
          accent="amber"
          subvalue={`${dashboard.totals.accessGrants} ${t("dashboard.totalGrants")}`}
        />
        <StatCard
          icon={KeyRound}
          label={t("dashboard.activeKeys")}
          note={t("dashboard.activeKeysNote")}
          value={dashboard.totals.activeKeys}
          accent="slate"
          subvalue={`${dashboard.totals.keys} ${t("dashboard.totalKeys")}`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.activityCoverage")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.buckets.map((bucket) => (
              <CoverageRow
                active={bucket.active}
                inactive={bucket.inactive}
                key={bucket.label}
                label={translateBucket(bucket.label, t)}
                other={bucket.other}
                total={bucket.total}
                t={t}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.resourceMix")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
            <DonutChart data={composition} total={composition.reduce((sum, item) => sum + item.value, 0)} />
            <div className="space-y-3">
              {composition.map((item) => (
                <div className="flex items-center justify-between rounded-[20px] border border-slate-100/90 bg-slate-50/70 px-4 py-3" key={item.label}>
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-950">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.scaleOverview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MiniBarChart
              data={[
                { label: t("dashboard.applications"), value: dashboard.totals.applications },
                { label: t("dashboard.totalAgents"), value: dashboard.totals.agents },
                { label: t("dashboard.runtimes"), value: dashboard.totals.runtimes },
                { label: t("dashboard.targetResources"), value: dashboard.totals.targetResources },
                { label: t("dashboard.totalConnections"), value: dashboard.totals.targetConnections },
                { label: t("dashboard.totalGrants"), value: dashboard.totals.accessGrants },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.operationsSnapshot")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <SnapshotItem label={t("dashboard.healthyChecks")} value={`${dashboard.totals.healthyChecks}/${dashboard.totals.totalChecks || 0}`} />
            <SnapshotItem label={t("dashboard.alerts")} value={dashboard.alerts} />
            <SnapshotItem label={t("dashboard.totalSecrets")} value={dashboard.totals.totalSecrets} />
            <SnapshotItem label={t("dashboard.totalRuntimeRegistrations")} value={dashboard.totals.totalRuntimeRegistrations} />
            <SnapshotItem label={t("dashboard.totalAgentGrants")} value={dashboard.totals.totalAgentGrants} />
            <SnapshotItem
              label={t("dashboard.avgGrantsPerConnection")}
              value={dashboard.totals.targetConnections > 0 ? (dashboard.totals.accessGrants / dashboard.totals.targetConnections).toFixed(1) : "0.0"}
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.infrastructure")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {Object.entries(checks).map(([name, ok]) => (
            <div className="flex items-center justify-between rounded-[20px] border border-slate-100/90 bg-slate-50/70 p-4" key={name}>
              <span className="font-medium text-slate-700">{name}</span>
              <StatusBadge status={ok ? "ready" : "degraded"} />
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}

function StatCard({
  accent,
  icon: Icon,
  label,
  note,
  subvalue,
  value,
}: {
  accent: "amber" | "blue" | "cyan" | "emerald" | "slate" | "violet";
  icon: typeof Activity;
  label: string;
  note: string;
  subvalue: string;
  value: number;
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  } as const;

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950">{value}</div>
          <div className="mt-2 text-sm font-medium text-slate-600">{subvalue}</div>
          <div className="mt-3 text-sm leading-6 text-slate-500">{note}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${accents[accent]}`}>
          <Icon size={20} />
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageRow({
  active,
  inactive,
  label,
  other,
  total,
  t,
}: {
  active: number;
  inactive: number;
  label: string;
  other: number;
  t: ReturnType<typeof useI18n>["t"];
  total: number;
}) {
  const safeTotal = total || 1;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{total}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-emerald-400" style={{ width: `${(active / safeTotal) * 100}%` }} />
        <div className="bg-slate-300" style={{ width: `${(inactive / safeTotal) * 100}%` }} />
        <div className="bg-sky-200" style={{ width: `${(other / safeTotal) * 100}%` }} />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{t("dashboard.chartActive")}: {active}</span>
        <span>{t("dashboard.chartInactive")}: {inactive}</span>
        <span>{t("dashboard.chartOther")}: {other}</span>
      </div>
    </div>
  );
}

function DonutChart({
  data,
  total,
}: {
  data: Array<{ color: string; label: string; value: number }>;
  total: number;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const segments = data.reduce<Array<{ color: string; label: string; offset: number; stroke: number }>>((items, item) => {
    const previousOffset = items.length > 0 ? items[items.length - 1]!.offset + items[items.length - 1]!.stroke : 0;
    const stroke = total > 0 ? (item.value / total) * circumference : 0;
    items.push({
      label: item.label,
      color: item.color,
      offset: previousOffset,
      stroke,
    });
    return items;
  }, []);

  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        <svg className="-rotate-90" height="180" viewBox="0 0 120 120" width="180">
          <circle cx="60" cy="60" fill="transparent" r={radius} stroke="rgba(226,232,240,0.8)" strokeWidth="16" />
          {segments.map((item) => (
              <circle
                cx="60"
                cy="60"
                fill="transparent"
                key={item.label}
                r={radius}
                stroke={item.color}
                strokeDasharray={`${item.stroke} ${circumference - item.stroke}`}
                strokeDashoffset={-item.offset}
                strokeLinecap="round"
                strokeWidth="16"
              />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">{total}</div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Total</div>
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((item) => (
        <div className="rounded-[22px] border border-slate-100/90 bg-slate-50/70 p-4" key={item.label}>
          <div className="text-sm font-medium text-slate-600">{item.label}</div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{item.value}</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb,#7dd3fc)]" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SnapshotItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[20px] border border-slate-100/90 bg-slate-50/70 p-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{value}</div>
    </div>
  );
}

function translateBucket(label: string, t: ReturnType<typeof useI18n>["t"]) {
  const translations: Record<string, string> = {
    Applications: t("dashboard.applications"),
    Agents: t("dashboard.totalAgents"),
    Runtimes: t("dashboard.runtimes"),
    Connections: t("dashboard.totalConnections"),
    Grants: t("dashboard.totalGrants"),
    Keys: t("dashboard.totalKeys"),
  };
  return translations[label] ?? label;
}
