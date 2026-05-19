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
    <div className="min-h-screen px-3 py-3 sm:px-4 sm:py-4">
      <AdminNav />
      <div className="xl:pl-[21.5rem]">
        <Topbar />
        <main className="px-3 pb-6 pt-4 sm:px-4 sm:pb-8 lg:px-6 xl:px-8 xl:pb-10 xl:pt-6">{children}</main>
      </div>
    </div>
  );
}
