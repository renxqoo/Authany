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
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-start gap-4 p-8 text-sm text-slate-500">
        <div>{children}</div>
        {action}
      </CardContent>
    </Card>
  );
}
