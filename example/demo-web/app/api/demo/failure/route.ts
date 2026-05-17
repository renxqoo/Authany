import { NextResponse } from "next/server";
import { accessFailureDemo } from "@/lib/server/target-access";

export async function GET() {
  const result = await accessFailureDemo();
  return NextResponse.json(result, { status: 403 });
}
