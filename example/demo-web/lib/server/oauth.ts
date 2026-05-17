import { randomBytes } from "node:crypto";
import { getDemoEnv } from "./env";
import { createPkcePair } from "./pkce";
import type { DemoSession } from "./session";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  scope?: string;
}

export function createAuthorizationRequest() {
  const env = getDemoEnv();
  return createAuthorizationRequestForRedirectUri(env.redirectUri);
}

export function createAuthorizationRequestForRedirectUri(redirectUri: string) {
  const env = getDemoEnv();
  const pkce = createPkcePair();
  const state = randomBytes(16).toString("base64url");
  const authorizeUrl = new URL(`${env.authanyBaseUrl}/oauth/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", env.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "openid profile offline_access");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", pkce.challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("prompt", "consent");
  return {
    url: authorizeUrl.toString(),
    state,
    verifier: pkce.verifier,
    redirectUri,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
}

export async function completeAuthorization(code: string, verifier: string, redirectUri?: string): Promise<DemoSession> {
  const token = await exchangeCode(code, verifier, redirectUri);
  const userInfo = await fetchUserInfo(token.access_token);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    idToken: token.id_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope,
    userInfo
  };
}

export async function exchangeCode(code: string, verifier: string, redirectUri = getDemoEnv().redirectUri) {
  const env = getDemoEnv();
  const response = await fetch(`${env.authanyBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  });
  if (!response.ok) {
    throw new Error("Token exchange failed.");
  }
  return response.json() as Promise<TokenResponse>;
}

async function fetchUserInfo(accessToken: string) {
  const env = getDemoEnv();
  const response = await fetch(`${env.authanyBaseUrl}/oauth/userinfo`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    return {};
  }
  return response.json() as Promise<Record<string, unknown>>;
}
