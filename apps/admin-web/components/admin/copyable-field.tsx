"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";

export function CopyableField({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200">{value}</code>
        <Button onClick={copy} type="button" variant="secondary">{copied ? t("common.copied") : t("common.copy")}</Button>
      </div>
    </div>
  );
}
