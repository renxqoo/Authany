"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppWindow,
  Binary,
  Cable,
  Gauge,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { getAdminNavigation } from "@/lib/admin/navigation";
import { cn } from "@/lib/utils";

export function AdminNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const navigation = getAdminNavigation(t);
  const iconByHref = {
    "/dashboard": Gauge,
    "/applications": AppWindow,
    "/agents": Sparkles,
    "/runtimes": Binary,
    "/target-resources": ShieldCheck,
    "/target-connections": Cable,
    "/access-grants": Waypoints,
    "/keys": KeyRound,
    "/audit-events": ScrollText,
  } as const;

  return (
    <aside className="border border-white/70 bg-white/70 shadow-[0_18px_46px_-30px_rgba(15,23,42,0.18)] backdrop-blur-2xl xl:fixed xl:inset-y-4 xl:left-4 xl:w-[19.5rem] xl:rounded-[32px]">
      <div className="flex h-full flex-col px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-6 rounded-[26px] border border-white/70 bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96)_56%,rgba(37,99,235,0.84))] p-5 text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.34)]">
          <div className="flex items-center gap-4">
            <div className="rounded-[20px] bg-white/12 p-3 text-white ring-1 ring-white/20">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">{t("admin.badge")}</div>
              <div className="mt-1 text-lg font-semibold">{t("app.name")}</div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-200">{t("app.subtitle")}</p>
        </div>
        <nav className="space-y-5 overflow-y-auto pr-1">
          {navigation.map((group) => (
            <div key={group.title}>
              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{group.title}</div>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = iconByHref[item.href as keyof typeof iconByHref] ?? ShieldCheck;
                  return (
                    <Link
                      className={cn(
                        "group flex items-center gap-3 rounded-[20px] px-3 py-3 text-sm font-medium transition",
                        active
                          ? "bg-slate-950 text-white shadow-[0_10px_22px_-16px_rgba(15,23,42,0.28)]"
                          : "text-slate-600 hover:bg-white/90 hover:text-slate-950",
                      )}
                      href={item.href}
                      key={item.href}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-2xl ring-1 transition",
                          active
                            ? "bg-white/12 text-white ring-white/12"
                            : "bg-slate-100 text-slate-500 ring-slate-200 group-hover:bg-slate-950 group-hover:text-white group-hover:ring-slate-950",
                        )}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="flex-1">{item.label}</span>
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full transition",
                          active ? "bg-sky-300" : "bg-transparent group-hover:bg-slate-300",
                        )}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
