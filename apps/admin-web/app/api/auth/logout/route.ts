import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/server/session";

export async function POST() {
  await clearAdminSession();
  return NextResponse.json({ code: "ok" });
}
