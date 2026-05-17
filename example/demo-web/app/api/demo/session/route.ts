import { NextResponse } from "next/server";
import { previewToken } from "@/lib/token-preview";
import { readDemoSession } from "@/lib/server/session";

export async function GET() {
  const session = await readDemoSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    expiresAt: session.expiresAt,
    scope: session.scope,
    userInfo: session.userInfo,
    tokens: {
      accessToken: previewToken(session.accessToken),
      refreshToken: previewToken(session.refreshToken),
      idToken: previewToken(session.idToken)
    }
  });
}
