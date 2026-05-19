"use client";

import { LockKeyhole, Sparkle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/language-provider";
import { getAdminNavigation } from "@/lib/admin/navigation";

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const activeTitle = getAdminNavigation(t).reduce<string | undefined>((current, group) => {
    if (current) {
      return current;
    }
    return group.items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label;
  }, undefined);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="sticky top-3 z-20 mb-4 rounded-[24px] border border-white/70 bg-white/72 px-4 py-3 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.16)] backdrop-blur-2xl sm:px-5 xl:top-4 xl:mb-0 xl:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              <LockKeyhole size={11} />
              {t("topbar.eyebrow")}
            </span>
            {activeTitle ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 ring-1 ring-sky-100">
                <Sparkle size={11} />
                {activeTitle}
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-base font-semibold text-slate-950 sm:text-lg">{t("topbar.title")}</div>
          <div className="mt-1 text-[13px] text-slate-500">{t("topbar.note")}</div>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-auto">
          <LanguageSwitcher />
          <Button className="h-10 rounded-xl px-3.5 text-sm" onClick={logout} variant="secondary">{t("auth.signOut")}</Button>
        </div>
      </div>
    </header>
  );
}
