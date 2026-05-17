import type React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-slate-950 text-white hover:bg-slate-800",
    secondary: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
  };

  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
