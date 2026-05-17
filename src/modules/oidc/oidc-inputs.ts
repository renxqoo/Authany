export interface ExchangeAuthorizationCodeInput {
  clientId: string;
  clientSecret?: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  ip?: string;
}

export interface ExchangeRefreshTokenInput {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  ip?: string;
}

export interface ExchangeClientCredentialsInput {
  clientId: string;
  clientSecret?: string;
  scope?: string;
  ip?: string;
}

export interface RevokeTokenInput {
  token: string;
  tokenTypeHint?: string;
  clientId: string;
  clientSecret?: string;
}

export interface IntrospectTokenInput extends Omit<RevokeTokenInput, "tokenTypeHint"> {
  tokenTypeHint?: string;
}

export interface CreateRefreshTokenRecordInput {
  clientId: string;
  jti: string;
  operatorId: string;
  refreshToken: string;
  scope: string;
}
