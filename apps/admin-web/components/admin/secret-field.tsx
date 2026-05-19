"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/language-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function SecretField({
  label,
  onReveal,
  value,
}: {
  label: string;
  onReveal?: () => Promise<string>;
  value?: string;
}) {
  const { t } = useI18n();
  const [secret, setSecret] = useState(value ?? "");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function reveal() {
    if (secret) {
      setVisible((current) => !current);
      return;
    }
    if (!onReveal) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      setSecret(await onReveal());
      setVisible(true);
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : t("secret.revealFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!secret || !visible) {
      return;
    }
    await navigator.clipboard?.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="rounded-[24px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.94),rgba(255,247,237,0.96))] p-4 shadow-[0_18px_36px_-28px_rgba(245,158,11,0.55)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <code className="min-w-0 flex-1 truncate rounded-2xl bg-white px-3 py-3 text-sm text-slate-900 ring-1 ring-amber-200">
          {visible && secret ? secret : "••••••••••••••••••••••••"}
        </code>
        <Button disabled={busy} onClick={reveal} type="button" variant="secondary">
          {visible ? t("common.hide") : busy ? t("common.loading") : t("common.reveal")}
        </Button>
        <Button disabled={!secret || !visible} onClick={copy} type="button">{copied ? t("common.copied") : t("common.copy")}</Button>
      </div>
      {error ? <Alert className="mt-3">{error}</Alert> : null}
      <Alert className="mt-3">{t("management.secret.notice")}</Alert>
    </div>
  );
}
