import type React from "react";
import { Card, CardContent } from "@/components/ui/card";

export function ManagementPage({
  actions,
  children,
  description,
  title
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function ManagementToolbar({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">{children}</div>;
}

export function EmptyState({
  action,
  children
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
