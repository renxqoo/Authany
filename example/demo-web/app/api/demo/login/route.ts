import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAuthorizationRequestForRedirectUri } from "@/lib/server/oauth";
import { writeDemoOAuthState } from "@/lib/server/oauth-state";
import { resolveRequestOrigin } from "@/lib/server/request-origin";

export async function GET(request: NextRequest) {
  const authorization = createAuthorizationRequestForRedirectUri(
    `${resolveRequestOrigin(request)}/callback`,
  );
  const response = NextResponse.redirect(authorization.url);
  writeDemoOAuthState(response, {
    state: authorization.state,
    verifier: authorization.verifier,
    redirectUri: authorization.redirectUri,
    expiresAt: authorization.expiresAt
  });
  return response;
}
