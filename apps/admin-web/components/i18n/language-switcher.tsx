"use client";

import { localeLabels, locales } from "@/lib/i18n/config";
import { useI18n } from "./language-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
      {t("language.label")}
      <select
        aria-label={t("language.label")}
        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none ring-slate-950/10 transition focus:ring-4"
        onChange={(event) => setLocale(event.target.value as typeof locale)}
        value={locale}
      >
        {locales.map((item) => (
          <option key={item} value={item}>{localeLabels[item]}</option>
        ))}
      </select>
    </label>
  );
}
