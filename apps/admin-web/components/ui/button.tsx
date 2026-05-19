import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] text-white shadow-[0_18px_30px_-18px_rgba(15,23,42,0.8)] hover:opacity-95",
    secondary: "border border-white/80 bg-white/78 text-slate-900 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.45)] hover:bg-white",
    ghost: "text-slate-600 hover:bg-white/80 hover:text-slate-950",
    danger: "bg-[linear-gradient(180deg,#ef4444_0%,#dc2626_100%)] text-white shadow-[0_18px_30px_-18px_rgba(220,38,38,0.8)] hover:opacity-95"
  };

  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
