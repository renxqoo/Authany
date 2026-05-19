import type React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "slate",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "green" | "red" | "amber" | "sky" | "slate";
}) {
  const tones = {
    green: "bg-emerald-50/90 text-emerald-700 ring-emerald-600/15",
    red: "bg-red-50/90 text-red-700 ring-red-600/15",
    amber: "bg-amber-50/90 text-amber-700 ring-amber-600/15",
    sky: "bg-sky-50/95 text-sky-700 ring-sky-600/15",
    slate: "bg-slate-100/90 text-slate-700 ring-slate-600/10",
  };

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1", tones[tone], className)}>
      {children}
    </span>
  );
}
