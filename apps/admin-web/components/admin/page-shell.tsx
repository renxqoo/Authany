import type React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AdminPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-6 lg:space-y-7", className)}>{children}</div>;
}

export function AdminHero({
  actions,
  children,
  description,
  eyebrow,
  size = "compact",
  title,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: string;
  size?: "compact" | "feature";
  title: React.ReactNode;
}) {
  const isFeature = size === "feature";

  return (
    <section
      className={cn(
        "relative overflow-hidden border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(246,250,255,0.98)_52%,rgba(239,246,255,0.92))] shadow-[0_18px_44px_-30px_rgba(15,23,42,0.2)]",
        isFeature
          ? "rounded-[32px] px-6 py-6 sm:px-8 sm:py-8"
          : "rounded-[28px] px-5 py-5 sm:px-6 sm:py-6",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_26rem),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_24rem)]" />
      <div className={cn("relative flex flex-col xl:flex-row xl:items-end xl:justify-between", isFeature ? "gap-6" : "gap-4")}>
        <div className="max-w-4xl">
          {eyebrow ? <Badge className={isFeature ? "mb-4" : "mb-3"} tone="sky">{eyebrow}</Badge> : null}
          <h1 className={cn("font-semibold tracking-[-0.04em] text-slate-950", isFeature ? "text-3xl sm:text-4xl" : "text-[28px] sm:text-[32px]")}>
            {title}
          </h1>
          {description ? (
            <div className={cn("max-w-3xl text-slate-600", isFeature ? "mt-3 text-sm leading-7 sm:text-[15px]" : "mt-2 text-sm leading-6")}>
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3 xl:justify-end">{actions}</div> : null}
      </div>
      {children ? <div className={cn("relative flex flex-wrap items-center", isFeature ? "mt-6 gap-3" : "mt-4 gap-2.5")}>{children}</div> : null}
    </section>
  );
}

export function AdminMetric({
  label,
  size = "compact",
  value,
}: {
  label: string;
  size?: "compact" | "feature";
  value: React.ReactNode;
}) {
  const isFeature = size === "feature";

  return (
    <div
      className={cn(
        "border border-white/80 bg-white/72 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.14)] backdrop-blur-xl",
        isFeature
          ? "min-w-[9.5rem] rounded-[22px] px-4 py-3"
          : "min-w-[8.5rem] rounded-[18px] px-3.5 py-2.5",
      )}
    >
      <div className={cn("font-semibold uppercase text-slate-400", isFeature ? "text-[11px] tracking-[0.22em]" : "text-[10px] tracking-[0.18em]")}>
        {label}
      </div>
      <div className={cn("font-semibold text-slate-950", isFeature ? "mt-2 text-base" : "mt-1.5 text-sm")}>{value}</div>
    </div>
  );
}
