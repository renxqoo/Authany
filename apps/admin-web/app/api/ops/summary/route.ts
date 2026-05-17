import { NextResponse } from "next/server";
import { getAdminEnv } from "@/lib/server/env";
import { readAdminSession } from "@/lib/server/session";

export async function GET() {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ code: "invalid_admin_token", message: "Admin session is required." }, { status: 401 });
  }

  const base = getAdminEnv().authanyBaseUrl;
  const [health, ready] = await Promise.all([
    fetch(`${base}/health`).then((item) => item.json()).catch(() => ({ status: "error" })),
    fetch(`${base}/ready`).then((item) => item.json()).catch(() => ({ status: "degraded" }))
  ]);

  return NextResponse.json({ health, ready });
}
