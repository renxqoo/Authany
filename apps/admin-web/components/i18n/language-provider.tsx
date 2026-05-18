"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type React from "react";
import { defaultLocale, localeCookieName, normalizeLocale } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";
import { createTranslator, type I18nTranslator } from "@/lib/i18n/translate";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: I18nTranslator;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? defaultLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `${localeCookieName}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale: (nextLocale) => setLocaleState(normalizeLocale(nextLocale)),
    t: createTranslator(messages, locale)
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return context;
}
