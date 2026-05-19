"use client";

import type React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DialogFrame({
  actions,
  children,
  title
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/38 p-4 backdrop-blur-xl sm:p-6">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[32px] border-white/80 bg-white/88 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.28)]">
        <CardHeader className="flex items-start justify-between gap-4 border-b border-slate-100/90 bg-[linear-gradient(135deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98)_45%,rgba(239,246,255,0.9))]">
          <CardTitle className="text-xl">{title}</CardTitle>
          {actions}
        </CardHeader>
        <CardContent className="p-6">{children}</CardContent>
      </Card>
    </div>
  );
}
