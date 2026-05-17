import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { TargetServiceEnv } from "./env.js";

export class TargetAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export interface TargetAccessClaims extends JWTPayload {
  sub: string;
  agent_id?: string;
  app_id?: string;
  delegation_type?: string;
  external_context?: Record<string, unknown>;
  token_use: "target_access";
}

export function bearerToken(authorization?: string) {
  if (!authorization?.startsWith("Bearer ")) {
    throw new TargetAuthError("Bearer target access token is required.", 401, "missing_token");
  }
  return authorization.slice("Bearer ".length).trim();
}

export async function verifyDelegationToken(authorization: string | undefined, env: TargetServiceEnv) {
  const token = bearerToken(authorization);
  const jwks = createRemoteJWKSet(new URL("/.well-known/jwks.json", env.issuer));
  const verified = await jwtVerify(token, jwks, {
    issuer: env.issuer,
    audience: env.audience
  });
  return assertDelegationClaims(verified.payload);
}

export function assertDelegationClaims(payload: JWTPayload): TargetAccessClaims {
  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const agentId = typeof payload.agent_id === "string" ? payload.agent_id : "";
  const appId = typeof payload.app_id === "string" ? payload.app_id : "";
  if (payload.token_use !== "target_access") {
    throw new TargetAuthError("Token is not a target access token.", 401, "invalid_token");
  }
  if (!subject || (!agentId && !appId)) {
    throw new TargetAuthError("Token is missing subject or principal identity.", 401, "invalid_token");
  }
  return {
    ...payload,
    sub: subject,
    agent_id: agentId || undefined,
    app_id: appId || undefined,
    token_use: "target_access"
  };
}
