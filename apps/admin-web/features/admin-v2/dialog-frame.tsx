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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[28px] border-slate-200 shadow-2xl">
        <CardHeader className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 via-white to-sky-50">
          <CardTitle className="text-xl">{title}</CardTitle>
          {actions}
        </CardHeader>
        <CardContent className="p-6">{children}</CardContent>
      </Card>
    </div>
  );
}

