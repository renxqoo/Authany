import {
  AuthAnyApiError,
  AuthAnyConnectionError,
  AuthAnyError,
  AuthAnyTimeoutError,
  RequesterTokenError,
  TargetTokenError
} from "./errors.js";
import { REQUESTER_TOKEN_GRANT_TYPE, TARGET_ACCESS_GRANT_TYPE } from "./grant-types.js";
import type {
  AuthAnyClientConfig,
  AuthAnyRequestOptions,
  RequesterTokenResult,
  TargetTokenIssuer,
  TargetTokenResult
} from "./types.js";

interface RequesterTokenApiResponse {
  requester_token: string;
  token_type: string;
  expires_in: number;
}

interface TargetTokenApiResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  issued_token_type: string;
  cache: "hit" | "miss" | "backend_error";
  jti: string;
}

interface ApiErrorPayload {
  code?: unknown;
  message?: unknown;
  data?: unknown;
}

interface RequestSignalState {
  signal: AbortSignal;
  cleanup: () => void;
  didTimeOut: () => boolean;
  wasExternallyAborted: () => boolean;
}

export class AuthAnyClient implements TargetTokenIssuer {
  private readonly issuer: string;
  private readonly callerCredential: string;
  private readonly principalType: "agent" | "application";
  private readonly agentId?: string;
  private readonly appId?: string;
  private readonly runtimeId?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;

  constructor(config: AuthAnyClientConfig) {
    this.issuer = normalizeIssuer(config.issuer);
    this.callerCredential = readRequiredString(config.callerCredential, "callerCredential");
    this.principalType = config.principalType;
    this.runtimeId = optionalString(config.runtimeId);
    this.fetchImpl = resolveFetch(config.fetch);
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.headers = { ...(config.headers ?? {}) };

    if (this.principalType === "agent") {
      this.agentId = readRequiredString(config.agentId, "agentId");
      this.appId = undefined;
    } else {
      this.appId = readRequiredString(config.appId, "appId");
      this.agentId = undefined;
    }
  }

  async exchangeTargetToken(
    targetResource: string,
    options: AuthAnyRequestOptions = {},
  ): Promise<TargetTokenResult> {
    const normalizedTarget = readRequiredString(targetResource, "targetResource");
    const requester = await this.issueRequesterToken(normalizedTarget, options);
    const token = await this.exchangeRequesterToken(normalizedTarget, requester.requesterToken, options.signal);
    return {
      accessToken: readRequiredResponseString(token.access_token, "access_token"),
      tokenType: readRequiredBearerTokenType(token.token_type),
      expiresIn: readRequiredResponseNumber(token.expires_in, "expires_in"),
      issuedTokenType: readRequiredResponseString(token.issued_token_type, "issued_token_type"),
      cache: readRequiredCacheStatus(token.cache),
      jti: readRequiredResponseString(token.jti, "jti")
    };
  }

  async getAccessToken(targetResource: string, options?: AuthAnyRequestOptions) {
    const result = await this.exchangeTargetToken(targetResource, options);
    return result.accessToken;
  }

  private async issueRequesterToken(
    targetResource: string,
    options: AuthAnyRequestOptions,
  ): Promise<RequesterTokenResult> {
    const response = await this.postJson<RequesterTokenApiResponse>(
      "api/requester-token",
      this.callerCredential,
      {
        grant_type: REQUESTER_TOKEN_GRANT_TYPE,
        principal_type: this.principalType,
        agent_id: this.agentId,
        app_id: this.appId,
        runtime_id: this.runtimeId,
        target_resource: targetResource,
        external_context: options.externalContext
      },
      (statusCode, payload) => createApiError(RequesterTokenError, statusCode, payload, "Requester token request failed."),
      options.signal,
    );

    return {
      requesterToken: readRequiredResponseString(response.requester_token, "requester_token"),
      tokenType: readRequiredResponseString(response.token_type, "token_type"),
      expiresIn: readRequiredResponseNumber(response.expires_in, "expires_in")
    };
  }

  private exchangeRequesterToken(
    targetResource: string,
    requesterToken: string,
    signal?: AbortSignal,
  ) {
    return this.postJson<TargetTokenApiResponse>(
      "api/target-token",
      requesterToken,
      {
        grant_type: TARGET_ACCESS_GRANT_TYPE,
        target_resource: targetResource
      },
      (statusCode, payload) => createApiError(TargetTokenError, statusCode, payload, "Target token request failed."),
      signal,
    );
  }

  private async postJson<T>(
    path: string,
    bearerToken: string,
    body: Record<string, unknown>,
    errorFactory: (statusCode: number, payload: unknown) => AuthAnyApiError,
    signal?: AbortSignal,
  ): Promise<T> {
    const requestSignal = createRequestSignal(this.timeoutMs, signal);
    try {
      const response = await this.fetchImpl(resolveUrl(this.issuer, path), {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...this.headers,
          authorization: `Bearer ${bearerToken}`
        },
        body: JSON.stringify(stripUndefined(body)),
        signal: requestSignal.signal
      });
      const payload = await parseResponsePayload(response);
      if (!response.ok) {
        throw errorFactory(response.status, payload);
      }
      return payload as T;
    } catch (error) {
      throw mapRequestError(error, requestSignal);
    } finally {
      requestSignal.cleanup();
    }
  }
}

function createRequestSignal(timeoutMs: number, externalSignal?: AbortSignal): RequestSignalState {
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("Request timed out."));
  }, timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    },
    didTimeOut: () => timedOut,
    wasExternallyAborted: () => Boolean(externalSignal?.aborted) && !timedOut
  };
}

function mapRequestError(error: unknown, requestSignal: RequestSignalState) {
  if (error instanceof AuthAnyError) {
    return error;
  }
  if (requestSignal.didTimeOut()) {
    return new AuthAnyTimeoutError("AuthAny request timed out.", "request_timeout", { cause: error });
  }
  if (requestSignal.wasExternallyAborted()) {
    return new AuthAnyError("AuthAny request was aborted.", "request_aborted", { cause: error });
  }
  return new AuthAnyConnectionError("Unable to reach AuthAny server.", "connection_error", { cause: error });
}

function createApiError<T extends AuthAnyApiError>(
  ErrorType: new (message: string, code: string, statusCode: number, data?: unknown, options?: ErrorOptions) => T,
  statusCode: number,
  payload: unknown,
  fallbackMessage: string,
) {
  const parsed = parseApiErrorPayload(payload);
  return new ErrorType(
    parsed.message ?? fallbackMessage,
    parsed.code ?? "http_error",
    statusCode,
    parsed.data,
  );
}

function parseApiErrorPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { code: undefined, message: undefined, data: undefined };
  }
  const record = payload as ApiErrorPayload;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    data: record.data
  };
}

async function parseResponsePayload(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function normalizeIssuer(issuer: string) {
  return readRequiredString(issuer, "issuer").replace(/\/+$/u, "");
}

function resolveUrl(issuer: string, path: string) {
  return new URL(path, `${issuer}/`).toString();
}

function resolveFetch(fetchImpl?: typeof fetch) {
  const value = fetchImpl ?? globalThis.fetch;
  if (typeof value !== "function") {
    throw new Error("A fetch implementation is required.");
  }
  return value;
}

function readRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function stripUndefined(body: Record<string, unknown>) {
  const entries = Object.entries(body).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
}

function readRequiredResponseString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`AuthAny response field ${fieldName} is invalid.`);
  }
  return value;
}

function readRequiredResponseNumber(value: unknown, fieldName: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`AuthAny response field ${fieldName} is invalid.`);
  }
  return value;
}

function readRequiredBearerTokenType(value: unknown): "Bearer" {
  if (value !== "Bearer") {
    throw new Error("AuthAny response field token_type is invalid.");
  }
  return "Bearer";
}

function readRequiredCacheStatus(value: unknown): "hit" | "miss" | "backend_error" {
  if (value === "hit" || value === "miss" || value === "backend_error") {
    return value;
  }
  throw new Error("AuthAny response field cache is invalid.");
}
