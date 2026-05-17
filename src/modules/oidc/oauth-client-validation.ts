import { HttpStatus } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { HashService } from "../../shared/security/hash.service";
import { apiError } from "../../shared/http/http-errors";
import { AppConfigService } from "../../shared/config/app-config.service";

export interface AuthorizeInput {
  responseType: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  nonce?: string;
}

export async function validateAuthorizationRequest(prisma: PrismaService, query: AuthorizeInput, config?: AppConfigService) {
  if (query.responseType !== "code") {
    throw apiError(HttpStatus.BAD_REQUEST, "unsupported_response_type", "Only response_type=code is supported.");
  }

  if (query.codeChallengeMethod !== "S256") {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_request", "Only S256 PKCE is supported.");
  }

  const client = await validateAuthorizationClient(prisma, query.clientId, query.redirectUri, config);
  const allowedGrantTypes = Array.isArray(client.allowedGrantTypes)
    ? client.allowedGrantTypes.map(String)
    : [];
  if (!allowedGrantTypes.includes("authorization_code")) {
    throw apiError(HttpStatus.BAD_REQUEST, "unauthorized_client", "OAuth client cannot use the authorization code flow.");
  }
  const requestedScopes = query.scope.split(" ").filter(Boolean);
  const allowedScopes = Array.isArray(client.allowedScopes)
    ? client.allowedScopes.map(String)
    : [];
  const invalidScope = requestedScopes.find((scope) => !allowedScopes.includes(scope));
  if (invalidScope) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_scope", `Scope is not allowed: ${invalidScope}`);
  }

  return client;
}

export async function validateAuthorizationClient(
  prisma: PrismaService,
  clientId: string,
  redirectUri: string,
  config?: AppConfigService,
) {
  const client = await prisma.oAuthClient.findFirst({
    where: {
      clientId,
      status: "active",
      deletedAt: null,
      tenantId: config?.tenantId
    },
    include: {
      redirectUris: true
    }
  });

  if (!client) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_client", "OAuth client is invalid.");
  }

  if (!client.redirectUris.some((item) => item.redirectUri === redirectUri)) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_redirect_uri", "Redirect URI does not match.");
  }

  return client;
}

export async function validateClientSecret(
  prisma: PrismaService,
  hashes: HashService,
  clientId: string,
  clientSecret?: string,
  config?: AppConfigService,
) {
  const client = await prisma.oAuthClient.findFirst({
    where: {
      clientId,
      status: "active",
      deletedAt: null,
      tenantId: config?.tenantId
    },
    include: {
      secrets: true
    }
  });

  if (!client) {
    throw apiError(HttpStatus.UNAUTHORIZED, "invalid_client", "OAuth client is invalid.");
  }

  const now = Date.now();
  const activeSecret = client.secrets.find((item) => (
    item.status === "active" &&
    (!item.expiresAt || item.expiresAt.getTime() > now)
  ));
  if (!activeSecret || !clientSecret || !hashes.verifySecret(clientSecret, activeSecret.secretHash)) {
    throw apiError(HttpStatus.UNAUTHORIZED, "invalid_client", "Client authentication failed.");
  }

  return client;
}
