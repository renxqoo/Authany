import { HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { decodeJwt } from "jose";
import type { FastifyRequest } from "fastify";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { AppConfigService } from "../../shared/config/app-config.service";
import { TokenSignerService } from "../../shared/security/token-signer.service";
import { TokenStatusService } from "../../shared/security/token-status.service";
import { HashService } from "../../shared/security/hash.service";
import { CurrentOperatorService } from "../../shared/security/current-user.service";
import { MetricsService } from "../../shared/metrics/metrics.service";
import { AuditService } from "../../shared/audit/audit.service";
import { RateLimitService } from "../../shared/rate-limit/rate-limit.service";
import { apiError } from "../../shared/http/http-errors";
import { PkceService } from "./pkce.service";
import {
  type AuthorizeInput,
  validateAuthorizationClient,
  validateAuthorizationRequest,
  validateClientSecret
} from "./oauth-client-validation";
import { introspectionResponse, tokenResponse } from "./token-response";
import { discoveryDocument } from "./discovery-document";
import type {
  CreateRefreshTokenRecordInput,
  ExchangeAuthorizationCodeInput,
  ExchangeClientCredentialsInput,
  ExchangeRefreshTokenInput,
  IntrospectTokenInput,
  RevokeTokenInput
} from "./oidc-inputs";

@Injectable()
export class OidcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly tokenSigner: TokenSignerService,
    private readonly hashes: HashService,
    private readonly currentOperator: CurrentOperatorService,
    private readonly pkce: PkceService,
    private readonly metrics: MetricsService,
    private readonly audit: AuditService,
    private readonly rateLimit: RateLimitService,
    private readonly tokenStatus: TokenStatusService,
  ) {}

  async getDiscoveryDocument() {
    return discoveryDocument(this.config.baseUrl);
  }

  async getJwks() {
    return this.tokenSigner.getJwks();
  }

  async getConsentDetails(query: AuthorizeInput) {
    const client = await validateAuthorizationRequest(this.prisma, query, this.config);
    return {
      clientId: client.clientId,
      clientName: client.name,
      scopeItems: query.scope.split(" ").filter(Boolean)
    };
  }

  async createAccessDeniedRedirect(query: Pick<AuthorizeInput, "clientId" | "redirectUri" | "state">) {
    await validateAuthorizationClient(this.prisma, query.clientId, query.redirectUri, this.config);
    const redirect = new URL(query.redirectUri);
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "The user denied the authorization request.");
    redirect.searchParams.set("state", query.state);
    return redirect.toString();
  }

  async createAuthorizationCode(query: AuthorizeInput, request: FastifyRequest) {
    const operatorId = await this.currentOperator.resolveOperatorId(request);
    if (!operatorId) {
      throw apiError(HttpStatus.UNAUTHORIZED, "login_required", "Operator must log in first.");
    }

    const client = await validateAuthorizationRequest(this.prisma, query, this.config);

    const rawCode = randomBytes(32).toString("base64url");
    await this.prisma.oAuthAuthorizationCode.create({
      data: {
        tenantId: this.config.tenantId,
        codeHash: this.hashes.hashOpaqueToken(rawCode),
        clientId: client.id,
        operatorId,
        redirectUri: query.redirectUri,
        scope: query.scope,
        codeChallenge: query.codeChallenge,
        codeChallengeMethod: query.codeChallengeMethod,
        status: "active",
        state: query.state,
        nonce: query.nonce,
        expiresAt: new Date(Date.now() + this.config.authCodeTtlSeconds * 1000)
      }
    });

    const redirect = new URL(query.redirectUri);
    redirect.searchParams.set("code", rawCode);
    redirect.searchParams.set("state", query.state);
    return redirect.toString();
  }

  async exchangeAuthorizationCode(input: ExchangeAuthorizationCodeInput) {
    await this.rateLimit.assertAllowed({
      key: `oauth:token:ip:${input.ip ?? "unknown"}`,
      limit: 60,
      windowSeconds: 60,
      metricName: "oauth.token.rate_limit"
    });
    await this.rateLimit.assertAllowed({
      key: `oauth:token:${input.clientId}`,
      limit: 120,
      windowSeconds: 60,
      metricName: "oauth.token.rate_limit"
    });
    const client = await validateClientSecret(this.prisma, this.hashes, input.clientId, input.clientSecret, this.config);
    assertGrantTypeAllowed(client.allowedGrantTypes, "authorization_code");
    const codeHash = this.hashes.hashOpaqueToken(input.code);
    const codeRecord = await this.prisma.oAuthAuthorizationCode.findUnique({
      where: { codeHash }
    });

    if (!codeRecord || codeRecord.status !== "active" || codeRecord.expiresAt.getTime() < Date.now()) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_grant", "Authorization code is invalid.");
    }

    if (codeRecord.clientId !== client.id || codeRecord.redirectUri !== input.redirectUri) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_grant", "Authorization code context does not match.");
    }

    if (!this.pkce.verify(input.codeVerifier, codeRecord.codeChallenge, codeRecord.codeChallengeMethod)) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_grant", "PKCE verification failed.");
    }

    const consumed = await this.prisma.oAuthAuthorizationCode.updateMany({
      where: {
        id: codeRecord.id,
        status: "active"
      },
      data: {
        status: "consumed",
        consumedAt: new Date()
      }
    });
    if (consumed.count !== 1) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_grant", "Authorization code is invalid.");
    }

    await this.audit.record({
      eventType: "oauth.token.issue",
      result: "success",
      operatorId: codeRecord.operatorId,
      clientId: client.id,
      payload: { grant_type: "authorization_code" }
    });
    this.metrics.increment("oauth.token.issue", { grant_type: "authorization_code", result: "success" });
    return this.issueStandardTokens({
      operatorId: codeRecord.operatorId,
      client,
      scope: codeRecord.scope
    });
  }

  async exchangeRefreshToken(input: ExchangeRefreshTokenInput) {
    await this.rateLimit.assertAllowed({
      key: `oauth:refresh:ip:${input.ip ?? "unknown"}`,
      limit: 60,
      windowSeconds: 60,
      metricName: "oauth.refresh.rate_limit"
    });
    await this.rateLimit.assertAllowed({
      key: `oauth:refresh:${input.clientId}`,
      limit: 120,
      windowSeconds: 60,
      metricName: "oauth.refresh.rate_limit"
    });
    const client = await validateClientSecret(this.prisma, this.hashes, input.clientId, input.clientSecret, this.config);
    assertGrantTypeAllowed(client.allowedGrantTypes, "refresh_token");
    const refreshRecord = await this.prisma.oAuthRefreshToken.findUnique({
      where: { tokenHash: this.hashes.hashOpaqueToken(input.refreshToken) }
    });

    if (
      !refreshRecord ||
      refreshRecord.status !== "active" ||
      refreshRecord.clientId !== client.id ||
      refreshRecord.expiresAt.getTime() < Date.now()
    ) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_grant", "Refresh token is invalid.");
    }

    const rotated = await this.prisma.oAuthRefreshToken.updateMany({
      where: {
        id: refreshRecord.id,
        status: "active"
      },
      data: {
        status: "rotated",
        revokedAt: new Date()
      }
    });
    if (rotated.count !== 1) {
      await this.revokeRefreshTokenFamily(refreshRecord.operatorId);
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_grant", "Refresh token is invalid.");
    }

    await this.audit.record({
      eventType: "oauth.token.refresh",
      result: "success",
      operatorId: refreshRecord.operatorId,
      clientId: client.id
    });
    this.metrics.increment("oauth.token.refresh", { result: "success" });
    return this.issueStandardTokens({
      operatorId: refreshRecord.operatorId,
      client,
      scope: refreshRecord.scope
    });
  }

  async exchangeClientCredentials(input: ExchangeClientCredentialsInput) {
    await this.rateLimit.assertAllowed({
      key: `oauth:client_credentials:ip:${input.ip ?? "unknown"}`,
      limit: 60,
      windowSeconds: 60,
      metricName: "oauth.client_credentials.rate_limit"
    });
    await this.rateLimit.assertAllowed({
      key: `oauth:client_credentials:${input.clientId}`,
      limit: 120,
      windowSeconds: 60,
      metricName: "oauth.client_credentials.rate_limit"
    });
    const client = await validateClientSecret(this.prisma, this.hashes, input.clientId, input.clientSecret, this.config);
    assertGrantTypeAllowed(client.allowedGrantTypes, "client_credentials");
    const scope = validateRequestedScope(input.scope, client.allowedScopes);
    const signed = await this.tokenSigner.signWithMetadata(
      {
        sub: `client:${client.clientId}`,
        scope,
        client_id: client.clientId
      },
      {
        audience: this.config.baseUrl,
        expiresInSeconds: this.config.accessTokenTtlSeconds
      },
    );

    await this.prisma.oAuthAccessTokenRecord.create({
      data: {
        tenantId: this.config.tenantId,
        jti: signed.jti,
        tokenType: "access_token",
        subjectType: "client",
        subjectId: client.id,
        clientId: client.id,
        audience: this.config.baseUrl,
        scope,
        claimsJson: { client_id: client.clientId },
        expiresAt: signed.expiresAt
      }
    });

    await this.audit.record({
      eventType: "oauth.token.issue",
      result: "success",
      clientId: client.id,
      payload: { grant_type: "client_credentials" }
    });
    this.metrics.increment("oauth.token.issue", { grant_type: "client_credentials", result: "success" });
    return {
      access_token: signed.token,
      token_type: "Bearer",
      expires_in: this.config.accessTokenTtlSeconds,
      scope
    };
  }

  async revokeToken(input: RevokeTokenInput) {
    const client = await validateClientSecret(this.prisma, this.hashes, input.clientId, input.clientSecret, this.config);
    const token = input.token;
    const tokenTypeHint = input.tokenTypeHint;
    const tokenHash = this.hashes.hashOpaqueToken(token);
    const refresh = await this.prisma.oAuthRefreshToken.findUnique({
      where: { tokenHash }
    });

    if (refresh) {
      if (refresh.clientId !== client.id) {
        throw apiError(HttpStatus.UNAUTHORIZED, "invalid_client", "Token does not belong to the authenticated client.");
      }
      await this.createRevocation(refresh.jti, tokenTypeHint ?? "refresh_token");

      await this.prisma.oAuthRefreshToken.update({
        where: { id: refresh.id },
        data: {
          status: "revoked",
          revokedAt: new Date()
        }
      });
    }

    if (!refresh) {
      const jti = this.extractJwtJti(token);
      if (jti) {
        const accessRecord = await this.prisma.oAuthAccessTokenRecord.findUnique({ where: { jti } });
        if (accessRecord?.clientId && accessRecord.clientId !== client.id) {
          throw apiError(HttpStatus.UNAUTHORIZED, "invalid_client", "Token does not belong to the authenticated client.");
        }
        await this.createRevocation(jti, tokenTypeHint ?? "access_token");
      }
    }

    await this.audit.record({
      eventType: "oauth.token.revoke",
      result: "success",
      payload: { token_type_hint: tokenTypeHint ?? "unknown" }
    });
    this.metrics.increment("oauth.token.revoke", { token_type_hint: tokenTypeHint ?? "unknown" });
    return {};
  }

  async introspectToken(input: IntrospectTokenInput) {
    await validateClientSecret(this.prisma, this.hashes, input.clientId, input.clientSecret, this.config);
    try {
      const verified = await this.tokenSigner.verify(input.token);
      const jti = String(verified.payload.jti ?? "");
      const record = jti
        ? await this.prisma.oAuthAccessTokenRecord.findUnique({ where: { jti } })
        : null;
      const revocation = jti
        ? await this.prisma.tokenRevocation.findFirst({ where: { tokenJti: jti } })
        : null;

      return introspectionResponse({
        active: Boolean(record && !revocation && record.expiresAt.getTime() > Date.now()),
        jti,
        payload: verified.payload
      });
    } catch (error) {
      if (isInvalidTokenError(error)) {
        return { active: false };
      }
      throw error;
    }
  }

  async getUserInfo(token: string) {
    const verified = await this.tokenSigner.verify(token);
    const jti = String(verified.payload.jti ?? "");
    if (!await this.tokenStatus.isActiveAccessToken({ jti, tokenType: "access_token" })) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_token", "Token is not active.");
    }
    const subject = String(verified.payload.sub ?? "");
    if (!subject.startsWith("operator:")) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_token", "Operator token is required.");
    }

    const operatorId = subject.slice("operator:".length);
    const operator = await this.prisma.operatorAccount.findFirst({
      where: {
        id: operatorId,
        tenantId: this.config.tenantId,
        status: "active"
      }
    });
    if (!operator) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_token", "Operator not found.");
    }

    return {
      sub: subject,
      preferred_username: operator.username,
      name: operator.displayName,
      email: operator.email
    };
  }

  private async issueStandardTokens(input: {
    operatorId: string;
    client: { id: string; clientId: string; allowedScopes?: unknown };
    scope: string;
  }) {
    const scope = input.scope;
    const requestedScopes = scope.split(" ").filter(Boolean);
    const allowedScopes = Array.isArray(input.client.allowedScopes)
      ? input.client.allowedScopes.map(String)
      : [];
    const effectiveScopes = requestedScopes.filter((item) => allowedScopes.includes(item));
    const requestingAdminScope = effectiveScopes.includes("authany.admin");
	    const adminRoles = requestingAdminScope ? await this.prisma.operatorRole.findMany({
	      where: {
	        operatorId: input.operatorId,
	        tenantId: this.config.tenantId,
	        status: "active"
	      }
    }) : [];
    const roleCodes = requestingAdminScope ? adminRoles.map((role) => role.roleCode) : [];
    if (requestingAdminScope && !roleCodes.includes("platform_admin")) {
      throw apiError(HttpStatus.FORBIDDEN, "insufficient_scope", "Operator is not allowed to receive admin scope.");
    }
    const effectiveScope = effectiveScopes.join(" ");
    const signedAccessToken = await this.tokenSigner.signWithMetadata(
      {
        sub: `operator:${input.operatorId}`,
        scope: effectiveScope,
        client_id: input.client.clientId,
        roles: roleCodes
      },
      {
        audience: this.config.baseUrl,
        expiresInSeconds: this.config.accessTokenTtlSeconds
      },
    );

    await this.prisma.oAuthAccessTokenRecord.create({
      data: {
        tenantId: this.config.tenantId,
        jti: signedAccessToken.jti,
        tokenType: "access_token",
        subjectType: "operator",
        subjectId: input.operatorId,
        clientId: input.client.id,
        audience: this.config.baseUrl,
        scope: effectiveScope,
        claimsJson: { client_id: input.client.clientId, roles: roleCodes },
        expiresAt: signedAccessToken.expiresAt
      }
    });

    const refreshToken = randomBytes(32).toString("base64url");
    const refreshJti = randomUUID();
    await this.createRefreshTokenRecord({
      clientId: input.client.id,
      jti: refreshJti,
      operatorId: input.operatorId,
      refreshToken,
      scope: effectiveScope
    });

    const idToken = await this.tokenSigner.sign(
      {
        sub: `operator:${input.operatorId}`,
        aud: input.client.clientId
      },
      {
        audience: input.client.clientId,
        expiresInSeconds: this.config.accessTokenTtlSeconds
      },
    );

    return tokenResponse({
      accessToken: signedAccessToken.token,
      expiresIn: this.config.accessTokenTtlSeconds,
      idToken,
      refreshToken,
      scope: effectiveScope
    });
  }

  private async createRevocation(tokenJti: string, tokenType: string) {
    await this.prisma.tokenRevocation.upsert({
      where: {
        tokenJti_tokenType: {
          tokenJti,
          tokenType
        }
      },
      create: {
        tenantId: this.config.tenantId,
        tokenJti,
        tokenType,
        reason: "manual_revoke"
      },
      update: {
        reason: "manual_revoke",
        revokedAt: new Date()
      }
    });
  }

  private async createRefreshTokenRecord(input: CreateRefreshTokenRecordInput) {
    await this.prisma.oAuthRefreshToken.create({
      data: {
        tenantId: this.config.tenantId,
        jti: input.jti,
        tokenHash: this.hashes.hashOpaqueToken(input.refreshToken),
        clientId: input.clientId,
        operatorId: input.operatorId,
        status: "active",
        scope: input.scope,
        expiresAt: new Date(Date.now() + this.config.refreshTokenTtlSeconds * 1000)
      }
    });
  }

  private async revokeRefreshTokenFamily(operatorId: string) {
    await this.prisma.oAuthRefreshToken.updateMany({
      where: {
        operatorId,
        status: "active"
      },
      data: {
        status: "revoked",
        revokedAt: new Date()
      }
    });
  }

  private extractJwtJti(token: string) {
    try {
      return String(decodeJwt(token).jti ?? "");
    } catch {
      return "";
    }
  }
}

function isInvalidTokenError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return [
    "ERR_JWS_INVALID",
    "ERR_JWT_EXPIRED",
    "ERR_JWT_CLAIM_VALIDATION_FAILED",
    "ERR_JWKS_INVALID"
  ].includes((error as Error & { code?: string }).code ?? "") || error.message.includes("JWT");
}

function assertGrantTypeAllowed(value: unknown, grantType: string) {
  const allowedGrantTypes = Array.isArray(value) ? value.map(String) : [];
  if (!allowedGrantTypes.includes(grantType)) {
    throw apiError(HttpStatus.UNAUTHORIZED, "unauthorized_client", "OAuth client is not allowed to use this grant type.");
  }
}

function validateRequestedScope(value: string | undefined, allowed: unknown) {
  const allowedScopes = Array.isArray(allowed) ? allowed.map(String) : [];
  const requestedScopes = (value ?? "openid").split(" ").filter(Boolean);
  const invalidScope = requestedScopes.find((scope) => !allowedScopes.includes(scope));
  if (invalidScope) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_scope", `Scope is not allowed: ${invalidScope}`);
  }
  return requestedScopes.join(" ");
}
