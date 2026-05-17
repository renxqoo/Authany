"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n/language-provider";
import { adminFetch } from "@/lib/api/admin-client";

interface Summary {
  health?: { status?: string };
  ready?: { status?: string; checks?: Record<string, boolean> };
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [metrics, setMetrics] = useState<{ counters?: unknown[]; alerts?: unknown[] } | null>(null);

  useEffect(() => {
    void fetch("/api/ops/summary").then((item) => item.json()).then(setSummary);
    void adminFetch<{ counters?: unknown[]; alerts?: unknown[] }>("metrics").then(setMetrics);
  }, []);

  if (!summary) {
    return <Skeleton className="h-80" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[36px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98)_45%,rgba(240,249,255,0.95))] p-8 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Overview</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{t("dashboard.title")}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{t("dashboard.description")}</p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label={t("dashboard.appHealth")} value={summary.health?.status ?? t("common.unknown")} />
        <MetricCard label={t("dashboard.readiness")} value={summary.ready?.status ?? t("common.unknown")} />
        <MetricCard label={t("dashboard.alerts")} value={String(metrics?.alerts?.length ?? 0)} />
      </div>
      <Card>
        <CardHeader><CardTitle>{t("dashboard.infrastructure")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {Object.entries(summary.ready?.checks ?? {}).map(([name, ok]) => (
            <div className="flex items-center justify-between rounded-xl border border-slate-100 p-4" key={name}>
              <span className="font-medium text-slate-700">{name}</span>
              <StatusBadge status={ok ? "ready" : "degraded"} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-[28px]">
      <CardContent className="p-6">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className="mt-4"><StatusBadge status={value} /></div>
      </CardContent>
    </Card>
  );
}
