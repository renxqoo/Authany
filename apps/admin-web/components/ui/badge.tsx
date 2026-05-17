import type React from "react";
import { cn } from "@/lib/utils";

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "green" | "red" | "amber" | "slate" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    red: "bg-red-50 text-red-700 ring-red-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    slate: "bg-slate-100 text-slate-700 ring-slate-600/10"
  };

  return <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1", tones[tone])}>{children}</span>;
}
