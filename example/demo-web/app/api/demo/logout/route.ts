import { NextResponse } from "next/server";
import { clearDemoSession } from "@/lib/server/session";

export async function POST() {
  await clearDemoSession();
  return NextResponse.json({ code: "ok" });
}
