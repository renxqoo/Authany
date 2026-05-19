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
    <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <code className="min-w-0 flex-1 truncate rounded-2xl bg-white px-3 py-3 text-sm text-slate-900 ring-1 ring-slate-200/80">{value}</code>
        <Button onClick={copy} type="button" variant="secondary">{copied ? t("common.copied") : t("common.copy")}</Button>
      </div>
    </div>
  );
}
