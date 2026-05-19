import type React from "react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  action,
  children,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-dashed border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.95))]">
      <CardContent className="flex flex-col items-start gap-4 p-8 text-sm leading-6 text-slate-500">
        <div>{children}</div>
        {action}
      </CardContent>
    </Card>
  );
}
