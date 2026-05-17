import { NextRequest, NextResponse } from "next/server";
import { completeAuthorization } from "@/lib/server/oauth";
import { clearDemoOAuthState, readDemoOAuthState } from "@/lib/server/oauth-state";
import { writeDemoSessionCookie } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    const response = NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, request.url));
    clearDemoOAuthState(response);
    return response;
  }

  const code = request.nextUrl.searchParams.get("code") ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const saved = await readDemoOAuthState();
  if (!code || !state || !saved || saved.state !== state) {
    return NextResponse.redirect(new URL("/?error=oauth_state", request.url));
  }

  try {
    const session = await completeAuthorization(code, saved.verifier, saved.redirectUri);
    const response = NextResponse.redirect(new URL("/", request.url));
    writeDemoSessionCookie(response, session);
    clearDemoOAuthState(response);
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/?error=oauth_callback", request.url));
    clearDemoOAuthState(response);
    return response;
  }
}
