import type { JWTPayload } from "jose";

export type PrincipalType = "agent" | "application" | "runtime";
export type RequesterPrincipalType = "agent" | "application";
export type IssuedSubjectType = "agent" | "application";

export interface RequesterClaims extends JWTPayload {
  app_id?: string;
  agent_id?: string;
  runtime_id?: string;
  target_resource?: string;
  request_id?: string;
  credential_id?: string;
  secret_id?: string;
  external_context?: Record<string, unknown>;
  token_use?: string;
}

export interface ActiveTargetResource {
  id: string;
  targetResourceCode: string;
  audience: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  issued_token_type: string;
  cache: "hit" | "miss" | "backend_error";
  jti: string;
}
