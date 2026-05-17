"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/language-provider";

export function Topbar() {
  const router = useRouter();
  const { t } = useI18n();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between border-b border-slate-200/80 bg-white/75 px-10 backdrop-blur">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700">Control Plane</div>
        <div className="mt-1 text-lg font-semibold text-slate-950">{t("topbar.title")}</div>
        <div className="mt-1 text-xs text-slate-500">{t("topbar.note")}</div>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <Button onClick={logout} variant="secondary">{t("auth.signOut")}</Button>
      </div>
    </header>
  );
}
