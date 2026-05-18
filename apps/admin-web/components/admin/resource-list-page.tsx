"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n/language-provider";
import { getResourceDefinition } from "@/lib/admin/resource-definitions";
import { AdminResourceApiError, adminResourceFetch, loadRemoteOptions, normalizeRows } from "@/lib/admin/resource-client";
import type { ResourceKey } from "@/lib/admin/types";
import { ResourceFormDialog } from "./resource-form-dialog";
import { CopyableField } from "./copyable-field";
import { ResourceTable } from "./resource-table";
import { SecretField } from "./secret-field";

export function AdminResourceListPage({ resourceKey }: { resourceKey: ResourceKey }) {
  const { t } = useI18n();
  const definition = useMemo(() => getResourceDefinition(resourceKey, t), [resourceKey, t]);
  const router = useRouter();
  const pathname = usePathname();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [remoteFilterOptions, setRemoteFilterOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({});
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const remoteFilters = useMemo(
    () => definition.filters?.filter((filter) => filter.optionSource) ?? [],
    [definition],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(normalizeRows(await adminResourceFetch(definition.endpoint)));
    } catch (loadError) {
      if (loadError instanceof AdminResourceApiError && loadError.status === 401) {
        router.replace(`/login?reason=session-expired&next=${encodeURIComponent(pathname)}`);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : t("admin.failedLoadRecords"));
    } finally {
      setLoading(false);
    }
  }, [definition.endpoint, pathname, router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (remoteFilters.length === 0) {
      return;
    }
    void Promise.all(
      remoteFilters.map(async (filter) => [filter.key, await loadRemoteOptions(filter.optionSource!)] as const),
    )
      .then((entries) => setRemoteFilterOptions(Object.fromEntries(entries)))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : t("admin.failedLoadFilters")));
  }, [remoteFilters, t]);

  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !keyword || definition.searchValues(row).some((value) => String(value ?? "").toLowerCase().includes(keyword));
      const matchesFilters = (definition.filters ?? []).every((filter) => {
        const filterValue = filters[filter.key];
        if (!filterValue) {
          return true;
        }
        return filter.getValue(row) === filterValue;
      });
      return matchesQuery && matchesFilters;
    });
  }, [definition, filters, query, rows]);

  async function create(payload: Record<string, unknown>) {
    const result = await adminResourceFetch<Record<string, unknown>>(definition.endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setLastResult(result);
    await load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[36px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98)_45%,rgba(240,249,255,0.95))] p-8 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">{t("admin.badge")}</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{definition.title}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">{definition.description}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => void load()} type="button" variant="secondary">{t("common.refresh")}</Button>
            {definition.createFields ? (
              <Button onClick={() => setCreating(true)} type="button">{definition.createLabel ?? t("common.create")}</Button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? <Alert>{error}</Alert> : null}
      {lastResult ? <MutationSummary result={lastResult} /> : null}

      <Card className="rounded-[32px] border-slate-200">
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,0.8fr))]">
            <Input onChange={(event) => setQuery(event.target.value)} placeholder={t("admin.searchPlaceholder", { title: definition.title })} value={query} />
            {(definition.filters ?? []).map((filter) => (
              <Select
                key={filter.key}
                onChange={(event) => setFilters((current) => ({ ...current, [filter.key]: event.target.value }))}
                value={filters[filter.key] ?? ""}
              >
                <option value="">{filter.label}</option>
                {(filter.options ?? remoteFilterOptions[filter.key] ?? []).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            ))}
          </div>
          {loading ? <Skeleton className="h-72 rounded-[28px]" /> : (
            <ResourceTable
              columns={definition.listColumns}
              emptyState={definition.emptyState}
              hrefForRow={(row) => `${definition.path}/${row.id}`}
              rows={visibleRows}
            />
          )}
        </CardContent>
      </Card>

      {creating && definition.createFields ? (
        <ResourceFormDialog
          fields={definition.createFields}
          mode="create"
          onClose={() => setCreating(false)}
          onSubmit={create}
          title={t("resource.createTitle", { title: definition.title })}
        />
      ) : null}
    </div>
  );
}

function MutationSummary({ result }: { result: Record<string, unknown> }) {
  const { t } = useI18n();
  const appSecret = typeof result.app_secret === "string" ? result.app_secret : "";
  const callerCredential = typeof result.caller_credential === "string" ? result.caller_credential : "";

  if (!appSecret && !callerCredential && typeof result.id !== "string" && typeof result.app_id !== "string" && typeof result.agent_id !== "string") {
    return null;
  }

  return (
    <Card className="rounded-[28px] border-amber-200 bg-amber-50/70">
      <CardContent className="grid gap-4 p-6 md:grid-cols-2">
        {typeof result.app_id === "string" ? <CopyableField label={t("admin.app.appId")} value={result.app_id} /> : null}
        {typeof result.agent_id === "string" ? <CopyableField label={t("field.agent_id")} value={result.agent_id} /> : null}
        {appSecret ? <SecretField label={t("resource.oneTimeAppSecret")} value={appSecret} /> : null}
        {callerCredential ? <SecretField label={t("resource.oneTimeCallerCredential")} value={callerCredential} /> : null}
      </CardContent>
    </Card>
  );
}
