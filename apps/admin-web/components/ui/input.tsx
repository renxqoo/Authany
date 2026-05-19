import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-slate-200/80 bg-white/86 px-4 text-sm text-slate-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-3 font-mono text-sm text-slate-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full appearance-none rounded-2xl border border-slate-200/80 bg-white/86 px-4 text-sm text-slate-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
