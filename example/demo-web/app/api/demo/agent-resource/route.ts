import { NextResponse } from "next/server";
import { accessAgentOnlyResource } from "@/lib/server/target-access";

export async function GET() {
  const result = await accessAgentOnlyResource();
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
