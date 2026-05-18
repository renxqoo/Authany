"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogFrame } from "./dialog-frame";

export function ResourceConfirmDialog({
  busy,
  confirmLabel,
  description,
  matchValue,
  onClose,
  onConfirm,
  title
}: {
  busy?: boolean;
  confirmLabel?: string;
  description: string;
  matchValue?: string;
  onClose: () => void;
  onConfirm: (confirmValue: string) => Promise<void>;
  title: string;
}) {
  const { t } = useI18n();
  const [confirmValue, setConfirmValue] = useState("");

  useEffect(() => {
    setConfirmValue("");
  }, [matchValue, title]);

  return (
    <DialogFrame title={title}>
      <div className="space-y-5">
        <p className="text-sm leading-6 text-slate-600">{description}</p>
        {matchValue ? (
          <label className="block text-sm font-medium text-slate-700">
            {confirmLabel ?? t("admin.confirm.matchValue")}
            <Input
              className="mt-2"
              onChange={(event) => setConfirmValue(event.target.value)}
              placeholder={matchValue}
              value={confirmValue}
            />
          </label>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} type="button" variant="secondary">{t("common.cancel")}</Button>
          <Button
            disabled={busy || (matchValue ? confirmValue !== matchValue : false)}
            onClick={() => void onConfirm(confirmValue)}
            type="button"
            variant="danger"
          >
            {busy ? t("common.working") : t("common.confirm")}
          </Button>
        </div>
      </div>
    </DialogFrame>
  );
}
