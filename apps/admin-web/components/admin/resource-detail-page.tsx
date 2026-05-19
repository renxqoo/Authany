"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getResourceDefinition } from "@/lib/admin/resource-definitions";
import { AdminResourceApiError, adminResourceFetch } from "@/lib/admin/resource-client";
import type { ResourceAction, ResourceKey } from "@/lib/admin/types";
import { readValue, renderResourceValue } from "./resource-display";
import { AdminHero, AdminMetric, AdminPageShell } from "./page-shell";
import { ResourceConfirmDialog } from "./resource-confirm-dialog";
import { ResourceFormDialog } from "./resource-form-dialog";

export function AdminResourceDetailPage({
  resourceKey,
  id
}: {
  resourceKey: ResourceKey;
  id: string;
}) {
  const { t } = useI18n();
  const definition = useMemo(() => getResourceDefinition(resourceKey, t), [resourceKey, t]);
  const router = useRouter();
  const pathname = usePathname();
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [activeAction, setActiveAction] = useState<ResourceAction | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setRecord(await adminResourceFetch<Record<string, unknown>>(`${definition.endpoint}/${id}`));
    } catch (loadError) {
      if (loadError instanceof AdminResourceApiError && loadError.status === 401) {
        router.replace(`/login?reason=session-expired&next=${encodeURIComponent(pathname)}`);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : t("admin.failedLoadDetails"));
    }
  }, [definition.endpoint, id, pathname, router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const headerStatus = useMemo(() => (record ? definition.status?.(record) : undefined), [definition, record]);

  async function save(payload: Record<string, unknown>) {
    await adminResourceFetch(`${definition.endpoint}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await load();
  }

  async function runAction(action: ResourceAction, confirmValue = "") {
    if (!record) {
      return;
    }
    setBusyAction(true);
    setError("");
    try {
      await adminResourceFetch(action.endpoint(id, record), {
        method: action.method ?? "POST",
        body: JSON.stringify(action.buildBody?.(record, confirmValue) ?? {})
      });
      setActiveAction(null);
      if (action.redirectToListOnSuccess) {
        router.push(definition.path);
        return;
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("admin.failedAction"));
    } finally {
      setBusyAction(false);
    }
  }

  if (!record) {
    return <Skeleton className="h-[42rem] rounded-[32px]" />;
  }

  return (
    <AdminPageShell>
      <AdminHero
        actions={(
          <>
            {(definition.detailActions ?? []).map((action) => (
              <Button key={action.label} onClick={() => setActiveAction(action)} type="button" variant={action.variant ?? "secondary"}>
                {action.label}
              </Button>
            ))}
            {definition.editFields ? (
              <Button onClick={() => setEditing(true)} type="button" variant="secondary">{t("common.edit")}</Button>
            ) : null}
          </>
        )}
        description={definition.subtitle?.(record) ?? definition.description}
        eyebrow={t("admin.badge")}
        title={(
          <>
            <Link className="text-sm font-medium text-sky-700 hover:text-sky-900" href={definition.path}>
              ← {t("admin.backToList", { title: definition.title })}
            </Link>
            <span className="mt-4 block">{definition.titleValue(record)}</span>
          </>
        )}
      >
        <AdminMetric label={t("resource.recordId")} value={id} />
        {headerStatus ? <AdminMetric label={t("field.status")} value={renderResourceValue(headerStatus, "status", t)} /> : null}
      </AdminHero>

      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {definition.detailSections.map((section) => (
          <Card className="rounded-[28px]" key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              {section.description ? <p className="mt-2 text-sm leading-6 text-slate-500">{section.description}</p> : null}
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              {section.fields.map((field) => (
                <div className="space-y-2 rounded-[22px] border border-slate-100/90 bg-slate-50/70 p-4" key={field.label}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{field.label}</div>
                  <div className="text-sm leading-6 text-slate-700">{renderResourceValue(readValue(record, field), field.kind, t)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {definition.extraSections?.(record, load)}

      {definition.dangerAction ? (
        <Card className="rounded-[28px] border-red-200/80 bg-[linear-gradient(180deg,rgba(254,242,242,0.92),rgba(254,226,226,0.88))]">
          <CardHeader>
            <CardTitle className="text-red-700">{t("admin.dangerZone")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl text-sm leading-6 text-red-700">
              {definition.dangerAction.confirmDescription ?? t("resource.dangerDescription")}
            </div>
            <Button onClick={() => setActiveAction(definition.dangerAction!)} type="button" variant="danger">
              {definition.dangerAction.label}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {editing && definition.editFields ? (
        <ResourceFormDialog
          fields={definition.editFields}
          initialRecord={record}
          mode="edit"
          onClose={() => setEditing(false)}
          onSubmit={save}
          title={`${t("common.edit")} ${definition.titleValue(record)}`}
        />
      ) : null}

      {activeAction ? (
        <ResourceConfirmDialog
          busy={busyAction}
          confirmLabel={activeAction.confirmLabel}
          description={activeAction.confirmDescription ?? t("admin.confirm.description")}
          matchValue={activeAction.confirmMatchValue?.(record)}
          onClose={() => setActiveAction(null)}
          onConfirm={(confirmValue) => runAction(activeAction, confirmValue)}
          title={activeAction.confirmTitle ?? activeAction.label}
        />
      ) : null}
    </AdminPageShell>
  );
}
