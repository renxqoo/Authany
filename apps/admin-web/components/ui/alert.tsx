import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,247,237,0.95))] px-4 py-3 text-sm text-amber-900 shadow-[0_18px_36px_-28px_rgba(245,158,11,0.55)]",
        className,
      )}
      {...props}
    />
  );
}
