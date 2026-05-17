export const localeCookieName = "authany_admin_locale";

export const locales = ["en", "zh-CN"] as const;

export type Locale = typeof locales[number];

export const defaultLocale: Locale = "zh-CN";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  "zh-CN": "中文"
};

export function normalizeLocale(value?: string | null): Locale {
  return value === "en" || value === "zh-CN" ? value : defaultLocale;
}
