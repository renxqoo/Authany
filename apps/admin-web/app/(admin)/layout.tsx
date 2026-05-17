import type React from "react";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/nav";
import { Topbar } from "@/components/admin/topbar";
import { readAdminSession } from "@/lib/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readAdminSession();
  if (!session) {
    redirect("/login?reason=session-required");
  }

  return (
    <div className="min-h-screen">
      <AdminNav />
      <div className="pl-80">
        <Topbar />
        <main className="p-10">{children}</main>
      </div>
    </div>
  );
}
