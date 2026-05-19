import type { Metadata } from "next";
import type React from "react";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/i18n/language-provider";
import { localeCookieName, normalizeLocale } from "@/lib/i18n/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuthAny Admin",
  description: "AuthAny enterprise authorization control plane"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value);

  return (
    <html lang={locale}>
      <body className="min-h-screen text-slate-900"><I18nProvider initialLocale={locale}>{children}</I18nProvider></body>
    </html>
  );
}
