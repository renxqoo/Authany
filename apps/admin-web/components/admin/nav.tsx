"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { adminV2Navigation } from "@/features/admin-v2/navigation";

export function AdminNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="fixed inset-y-0 left-0 w-80 border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98)_20%,rgba(248,250,252,0.98))] px-6 py-7 backdrop-blur">
      <div className="mb-10 rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="rounded-[22px] bg-slate-950 p-3 text-white shadow-lg shadow-slate-950/15">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="font-semibold text-slate-950">{t("app.name")}</div>
            <div className="text-xs uppercase tracking-[0.22em] text-amber-700">Admin UI V2</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-500">{t("app.subtitle")}</p>
      </div>
      <nav className="space-y-7">
        {adminV2Navigation.map((group) => (
          <div key={group.title}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{group.title}</div>
            <div className="space-y-1.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    className={cn(
                      "block rounded-2xl px-4 py-3 text-sm font-medium transition",
                      active
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                        : "text-slate-700 hover:bg-white hover:text-slate-950",
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
