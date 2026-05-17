import { NextResponse } from "next/server";
import { readDemoSession } from "@/lib/server/session";
import { accessTargetResource } from "@/lib/server/target-access";

export async function GET() {
  const session = await readDemoSession();
  if (!session) {
    return NextResponse.json({
      ok: false,
      stage: "session",
      message: "Demo Web session is required."
    }, { status: 401 });
  }

  const result = await accessTargetResource(session);
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
