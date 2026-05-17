import { createHash, randomBytes } from "node:crypto";
import { getAdminEnv } from "./env";

export async function loginWithPassword(input: { username: string; password: string }) {
  const env = getAdminEnv();
  const login = await fetch(`${env.authanyBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!login.ok) {
    throw new Error("Invalid administrator username or password.");
  }

  const upstreamCookie = login.headers.get("set-cookie") ?? "";
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(16).toString("base64url");
	  const authorizeUrl = new URL(`${env.authanyBaseUrl}/oauth/authorize`);
  const redirectUri = new URL("/api/auth/callback", env.publicBaseUrl).toString();
	  authorizeUrl.searchParams.set("response_type", "code");
	  authorizeUrl.searchParams.set("client_id", env.adminClientId);
	  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "openid profile offline_access authany.admin");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const authorize = await fetch(authorizeUrl, {
    redirect: "manual",
    headers: { cookie: upstreamCookie }
  });
  const location = authorize.headers.get("location");
  if (!location) {
    throw new Error("Admin authorization failed.");
  }

  const callback = new URL(location);
  if (callback.searchParams.get("state") !== state) {
    throw new Error("Admin authorization state did not match.");
  }

  const token = await fetch(`${env.authanyBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
	      grant_type: "authorization_code",
	      client_id: env.adminClientId,
	      client_secret: env.adminClientSecret,
	      code: callback.searchParams.get("code"),
	      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  });
  if (!token.ok) {
    throw new Error("Admin token exchange failed.");
  }

  return token.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

function challenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
