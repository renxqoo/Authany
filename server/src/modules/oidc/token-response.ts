import type { JWTPayload } from "jose";

export function introspectionResponse(input: {
  active: boolean;
  jti: string;
  payload: JWTPayload;
}) {
  return {
    active: input.active,
    sub: input.payload.sub,
    client_id: input.payload.client_id,
    scope: input.payload.scope,
    token_type: "Bearer",
    exp: input.payload.exp,
    iat: input.payload.iat,
    iss: input.payload.iss,
    aud: input.payload.aud,
    jti: input.jti
  };
}

export function tokenResponse(input: {
  accessToken: string;
  expiresIn: number;
  idToken?: string;
  refreshToken?: string;
  scope: string;
}) {
  return {
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    id_token: input.idToken,
    token_type: "Bearer",
    expires_in: input.expiresIn,
    scope: input.scope
  };
}
