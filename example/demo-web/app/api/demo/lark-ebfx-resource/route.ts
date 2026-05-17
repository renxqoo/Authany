import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accessLarkEbfxResource } from "@/lib/server/target-access";

export async function GET(request: NextRequest) {
  const senderId = request.nextUrl.searchParams.get("sender_id")?.trim() ?? "";
  if (!senderId) {
    return NextResponse.json({
      ok: false,
      stage: "request",
      code: "sender_id_required",
      message: "Lark sender_id is required."
    }, { status: 400 });
  }

  const result = await accessLarkEbfxResource(senderId);
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
