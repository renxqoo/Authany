import { createRemoteJWKSet, customFetch, jwtVerify, type JWTPayload } from "jose";
import { TokenVerificationError } from "./errors.js";
import type { TargetAccessClaims, TargetTokenVerifierConfig } from "./types.js";

export class TargetTokenVerifier {
  private readonly issuer: string;
  private readonly audience: string | string[];
  private readonly targetResource?: string;
  private readonly clockToleranceSeconds: number;
  private readonly fetchImpl: typeof fetch;
  private readonly jwksTimeoutMs: number;
  private readonly jwksUrl: URL;
  private readonly sharedJwks;

  constructor(config: TargetTokenVerifierConfig) {
    this.issuer = normalizeIssuer(config.issuer);
    this.audience = validateAudience(config.audience);
    this.targetResource = optionalString(config.targetResource);
    this.clockToleranceSeconds = config.clockToleranceSeconds ?? 5;
    this.fetchImpl = resolveFetch(config.fetch);
    this.jwksTimeoutMs = config.jwksTimeoutMs ?? 5_000;
    this.jwksUrl = new URL(".well-known/jwks.json", `${this.issuer}/`);
    this.sharedJwks = this.createJwks();
  }

  async verify(token: string, options?: { signal?: AbortSignal }): Promise<TargetAccessClaims> {
    const rawToken = token.trim();
    if (!rawToken) {
      throw new TokenVerificationError("Target access token is required.", "missing_token");
    }

    try {
      const verified = await jwtVerify(
        rawToken,
        options?.signal ? this.createJwks(options.signal) : this.sharedJwks,
        {
          issuer: this.issuer,
          audience: this.audience,
          clockTolerance: this.clockToleranceSeconds
        },
      );
      return assertTargetAccessClaims(verified.payload, this.targetResource);
    } catch (error) {
      if (error instanceof TokenVerificationError) {
        throw error;
      }
      throw new TokenVerificationError("Target access token is invalid.", "invalid_token", { cause: error });
    }
  }

  private createJwks(signal?: AbortSignal) {
    return createRemoteJWKSet(this.jwksUrl, {
      timeoutDuration: this.jwksTimeoutMs,
      [customFetch]: createVerifierFetch(this.fetchImpl, signal)
    });
  }
}

function createVerifierFetch(fetchImpl: typeof fetch, externalSignal?: AbortSignal) {
  return async (
    url: string,
    options: {
      headers: Headers;
      method: "GET";
      redirect: "manual";
      signal: AbortSignal;
    },
  ) => {
    const signal = mergeSignals(options.signal, externalSignal);
    try {
      const response = await fetchImpl(url, {
        method: options.method,
        headers: options.headers,
        redirect: options.redirect,
        signal
      });
      if (!response.ok) {
        throw new TokenVerificationError("Failed to fetch JWKS.", "jwks_fetch_failed");
      }
      return response;
    } catch (error) {
      if (error instanceof TokenVerificationError) {
        throw error;
      }
      throw new TokenVerificationError("Failed to fetch JWKS.", "jwks_fetch_failed", { cause: error });
    }
  };
}

function mergeSignals(primary: AbortSignal, secondary?: AbortSignal) {
  if (!secondary) {
    return primary;
  }

  const controller = new AbortController();
  const forwardAbort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  if (primary.aborted) {
    forwardAbort(primary);
  } else {
    primary.addEventListener("abort", () => forwardAbort(primary), { once: true });
  }

  if (secondary.aborted) {
    forwardAbort(secondary);
  } else {
    secondary.addEventListener("abort", () => forwardAbort(secondary), { once: true });
  }

  return controller.signal;
}

function assertTargetAccessClaims(payload: JWTPayload, expectedTargetResource?: string): TargetAccessClaims {
  if (payload.token_use !== "target_access") {
    throw new TokenVerificationError("Token is not a target access token.", "invalid_token_use");
  }

  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const targetResource = typeof payload.target_resource === "string" ? payload.target_resource : "";
  const agentId = typeof payload.agent_id === "string" ? payload.agent_id : undefined;
  const appId = typeof payload.app_id === "string" ? payload.app_id : undefined;
  const issuer = typeof payload.iss === "string" ? payload.iss : "";
  const issuedAt = typeof payload.iat === "number" ? payload.iat : 0;
  const expiresAt = typeof payload.exp === "number" ? payload.exp : 0;
  const jti = typeof payload.jti === "string" ? payload.jti : "";
  const audience = readAudience(payload.aud);

  if (!subject || (!agentId && !appId)) {
    throw new TokenVerificationError("Token is missing subject or principal identity.", "invalid_principal");
  }

  if (!subjectMatchesPrincipal(subject, agentId, appId)) {
    throw new TokenVerificationError("Token subject does not match principal identity.", "subject_mismatch");
  }

  if (expectedTargetResource && targetResource !== expectedTargetResource) {
    throw new TokenVerificationError("Token target_resource does not match.", "target_resource_mismatch");
  }

  if (!issuer || !issuedAt || !expiresAt || !jti || !targetResource || !audience) {
    throw new TokenVerificationError("Target access token is invalid.", "invalid_token");
  }

  return {
    ...payload,
    iss: issuer,
    aud: audience,
    sub: subject,
    exp: expiresAt,
    iat: issuedAt,
    jti,
    token_use: "target_access",
    target_resource: targetResource,
    agent_id: agentId,
    app_id: appId
  };
}

function subjectMatchesPrincipal(subject: string, agentId?: string, appId?: string) {
  if (subject.startsWith("agent:")) {
    return agentId === subject.slice("agent:".length);
  }
  if (subject.startsWith("app:")) {
    return appId === subject.slice("app:".length);
  }
  return false;
}

function readAudience(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value as string[];
  }
  return undefined;
}

function validateAudience(audience: string | string[]) {
  if (typeof audience === "string") {
    const trimmed = audience.trim();
    if (trimmed) {
      return trimmed;
    }
    throw new Error("audience is required.");
  }
  if (Array.isArray(audience) && audience.length > 0 && audience.every((item) => typeof item === "string" && item.trim() !== "")) {
    return audience;
  }
  throw new Error("audience is required.");
}

function normalizeIssuer(issuer: string) {
  if (typeof issuer !== "string" || issuer.trim() === "") {
    throw new Error("issuer is required.");
  }
  return issuer.trim().replace(/\/+$/u, "");
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function resolveFetch(fetchImpl?: typeof fetch) {
  const value = fetchImpl ?? globalThis.fetch;
  if (typeof value !== "function") {
    throw new Error("A fetch implementation is required.");
  }
  return value;
}
