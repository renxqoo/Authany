import type React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white/90 shadow-xl shadow-sky-950/5 ${className}`}>{children}</section>;
}
