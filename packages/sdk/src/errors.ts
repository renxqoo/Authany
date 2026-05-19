export class AuthAnyError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class AuthAnyApiError extends AuthAnyError {
  constructor(
    message: string,
    code: string,
    readonly statusCode: number,
    readonly data?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, code, options);
  }
}

export class RequesterTokenError extends AuthAnyApiError {}

export class TargetTokenError extends AuthAnyApiError {}

export class AuthAnyConnectionError extends AuthAnyError {}

export class AuthAnyTimeoutError extends AuthAnyError {}

export type TokenVerificationErrorCode =
  | "missing_token"
  | "invalid_token"
  | "invalid_token_use"
  | "invalid_principal"
  | "subject_mismatch"
  | "target_resource_mismatch"
  | "jwks_fetch_failed";

export class TokenVerificationError extends Error {
  constructor(
    message: string,
    readonly code: TokenVerificationErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}
