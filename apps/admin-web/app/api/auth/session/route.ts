import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/server/session";

export async function GET() {
  const session = await readAdminSession();
  return NextResponse.json({
    authenticated: Boolean(session),
    expiresAt: session?.expiresAt ?? null
  });
}
