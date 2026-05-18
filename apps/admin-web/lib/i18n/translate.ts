import type { Locale } from "./config";

export type TranslationParams = Record<string, string | number>;
export type I18nTranslator = (key: string, params?: TranslationParams, fallback?: string) => string;
export type MessageCatalog = Record<Locale, Record<string, string>>;

export function createTranslator(catalog: MessageCatalog, locale: Locale): I18nTranslator {
  return (key, params, fallback) => {
    const active = catalog[locale] as Record<string, string>;
    const english = catalog.en as Record<string, string>;
    return interpolate(active[key] ?? fallback ?? english[key] ?? key, params);
  };
}

export function interpolate(template: string, params?: TranslationParams) {
  return Object.entries(params ?? {}).reduce(
    (value, [key, replacement]) => value.replaceAll(`{${key}}`, String(replacement)),
    template,
  );
}
