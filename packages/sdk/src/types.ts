import type { JWTPayload } from "jose";

export type PrincipalType = "agent" | "application";
export type TokenCacheStatus = "hit" | "miss" | "backend_error";

export interface TargetTokenResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  issuedTokenType: string;
  cache: TokenCacheStatus;
  jti: string;
}

export interface AuthAnyRequestOptions {
  externalContext?: Record<string, unknown>;
  signal?: AbortSignal;
}

interface AuthAnyClientBaseConfig {
  issuer: string;
  callerCredential: string;
  runtimeId?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface AgentAuthAnyClientConfig extends AuthAnyClientBaseConfig {
  principalType: "agent";
  agentId: string;
  appId?: never;
}

export interface ApplicationAuthAnyClientConfig extends AuthAnyClientBaseConfig {
  principalType: "application";
  appId: string;
  agentId?: never;
}

export type AuthAnyClientConfig =
  | AgentAuthAnyClientConfig
  | ApplicationAuthAnyClientConfig;

export interface RequesterTokenResult {
  requesterToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthorizedRuntimeConfig {
  client: TargetTokenIssuer;
  tokenEnvName?: string;
}

export interface AuthorizedEnvOptions extends AuthAnyRequestOptions {
  baseEnv?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  tokenEnvName?: string;
}

export interface CommandRunOptions extends AuthAnyRequestOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  targetResource: string;
  stdin?: string;
}

export interface CommandRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  signal?: NodeJS.Signals;
  token: TargetTokenResult;
}

export interface TargetTokenIssuer {
  exchangeTargetToken(targetResource: string, options?: AuthAnyRequestOptions): Promise<TargetTokenResult>;
}

export interface TargetTokenVerifierConfig {
  issuer: string;
  audience: string | string[];
  targetResource?: string;
  clockToleranceSeconds?: number;
  fetch?: typeof fetch;
  jwksTimeoutMs?: number;
}

export interface TargetAccessClaims extends JWTPayload {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  jti: string;
  token_use: "target_access";
  target_resource: string;
  agent_id?: string;
  app_id?: string;
  delegation_type?: string;
  external_context?: Record<string, unknown>;
}
