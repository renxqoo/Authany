import { HttpStatus, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { AppConfigService } from "../../shared/config/app-config.service";
import { AuditService } from "../../shared/audit/audit.service";
import { apiError } from "../../shared/http/http-errors";
import { MetricsService } from "../../shared/metrics/metrics.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { RateLimitService } from "../../shared/rate-limit/rate-limit.service";
import { TokenSignerService } from "../../shared/security/token-signer.service";
import { CallerCredentialService } from "./caller-credential.service";
import { DelegationPolicyService, digestJson } from "./delegation-policy.service";
import { ReplayProtectionService } from "./replay-protection.service";
import { TargetTokenBrokerService, type TargetTokenBrokerResult } from "./delegation-token-broker.service";
import type { ActiveTargetResource, IssuedSubjectType, RequesterClaims, TokenResponse } from "./delegation-types";

@Injectable()
export class TargetTokenExchangeService {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly callerCredentials: CallerCredentialService,
    private readonly replayProtection: ReplayProtectionService,
    private readonly broker: TargetTokenBrokerService,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
    private readonly rateLimit: RateLimitService,
    private readonly tokenSigner: TokenSignerService,
    private readonly policy: DelegationPolicyService,
  ) {}

  async exchange(
    request: FastifyRequest,
    input: {
      grantType: string;
      targetResource: string;
    },
  ): Promise<TokenResponse> {
    if (input.grantType !== "urn:authany:params:oauth:grant-type:target-access") {
      throw apiError(HttpStatus.BAD_REQUEST, "unsupported_grant_type", "Target token grant type is invalid.");
    }

    const requester = await this.verifyRequesterJwt(request);
    this.assertRequesterTokenUse(requester);
    this.assertTargetMatches(input.targetResource, requester.target_resource);
    const principal = this.resolveRequesterPrincipal(requester);
    const requestId = readRequiredString(requester.request_id ?? requester.jti, "invalid_requester_jwt", "Requester JWT must include request_id or jti.");

    await this.rateLimit.assertAllowed({
      key: `target-token:${principal.type}:${principal.id}:${input.targetResource}`,
      limit: 300,
      windowSeconds: 60,
      metricName: "target_token.exchange.rate_limit"
    });

    try {
      await this.replayProtection.assertNotReplayed(requestId);
    } catch (error) {
      await this.audit.record({
        eventType: "target_token.replay",
        result: "denied",
        requestId,
        errorCode: getApiErrorCode(error),
        payload: { principal_type: principal.type, principal_id: principal.id, target_resource: input.targetResource }
      });
      throw error;
    }

    const target = await this.policy.requireActiveTargetResource(input.targetResource);
    if (principal.type === "application") {
      return this.exchangeForApplication({
        appId: principal.id,
        secretId: requester.secret_id,
        target,
        externalContext: requester.external_context,
        requestId
      });
    }

    return this.exchangeForAgentRequester({
      agentId: principal.id,
      runtimeId: requester.runtime_id,
      credentialId: requester.credential_id,
      target,
      externalContext: requester.external_context,
      requestId
    });
  }

  private async verifyRequesterJwt(request: FastifyRequest): Promise<RequesterClaims> {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (!token) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_requester_jwt", "Requester JWT is missing.");
    }

    try {
      const { payload } = await this.tokenSigner.verify(token, this.config.baseUrl);
      return payload as RequesterClaims;
    } catch (error) {
      if (!isInvalidJwtError(error)) {
        throw error;
      }
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_requester_jwt", "Requester JWT is invalid.");
    }
  }

  private resolveRequesterPrincipal(claims: RequesterClaims) {
    const subject = readRequiredString(claims.sub, "invalid_requester_jwt", "Requester JWT subject is required.");
    if (subject.startsWith("agent:")) {
      const agentId = subject.slice("agent:".length);
      if (claims.agent_id !== agentId) {
        throw apiError(HttpStatus.UNAUTHORIZED, "invalid_requester_jwt", "Requester JWT agent_id does not match subject.");
      }
      return { type: "agent" as const, id: agentId };
    }
    if (subject.startsWith("app:")) {
      const appId = subject.slice("app:".length);
      if (claims.app_id !== appId) {
        throw apiError(HttpStatus.UNAUTHORIZED, "invalid_requester_jwt", "Requester JWT app_id does not match subject.");
      }
      return { type: "application" as const, id: appId };
    }
    throw apiError(HttpStatus.UNAUTHORIZED, "invalid_requester_jwt", "Requester JWT subject is unsupported.");
  }

  private assertRequesterTokenUse(claims: RequesterClaims) {
    if (claims.token_use !== "requester_assertion") {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_requester_jwt", "Requester JWT token_use is invalid.");
    }
  }

  private assertTargetMatches(bodyTarget: string, claimTarget?: string) {
    if (claimTarget !== bodyTarget) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_requester_jwt", "Requester JWT target_resource does not match request body.");
    }
  }

  private async exchangeForAgentRequester(input: {
    agentId: string;
    runtimeId?: string;
    credentialId?: string;
    target: ActiveTargetResource;
    externalContext?: Record<string, unknown>;
    requestId: string;
  }) {
    const agent = await this.prisma.agentProfile.findFirst({
      where: {
        agentId: input.agentId,
        tenantId: this.config.tenantId,
        deletedAt: null
      }
    });

    if (!agent || agent.status !== "active") {
      throw apiError(HttpStatus.FORBIDDEN, "invalid_agent", "Agent is invalid.");
    }

    const runtime = input.runtimeId ? await this.prisma.runtimeRegistration.findFirst({
      where: {
        runtimeId: input.runtimeId,
        agentId: agent.id,
        tenantId: this.config.tenantId
      }
    }) : null;
    if (input.runtimeId && (!runtime || runtime.status !== "active")) {
      throw apiError(HttpStatus.FORBIDDEN, "invalid_runtime", "Runtime registration is invalid.");
    }

    const credential = await this.callerCredentials.requireActiveForAgent({
      agentDbId: agent.id,
      runtimeDbId: runtime?.id,
      credentialId: input.credentialId
    });

    const connection = await this.policy.findConnection({
      principalType: "agent",
      principalId: agent.agentId,
      runtimeDbId: runtime?.id,
      runtimeId: runtime?.runtimeId,
      targetResource: input.target.targetResourceCode
    });
    if (!connection) {
      await this.recordConnectionDenied(agent.id, agent.agentId, input);
      throw apiError(HttpStatus.FORBIDDEN, "connection_not_allowed", "Target connection is not available for this principal.");
    }

    this.policy.assertExternalContextPolicy(connection, input.externalContext);
    const grant = await this.requireGrant(connection.id);
    const externalContextDigest = input.externalContext ? digestJson(input.externalContext) : undefined;
    const brokerResult = await this.broker.getOrIssue({
      context: {
        audience: input.target.audience,
        connectionId: connection.id,
        credentialId: credential.id,
        grantId: grant.id,
        externalContextDigest,
        principalId: agent.agentId,
        principalType: "agent",
        runtimeId: runtime?.id,
        targetId: input.target.id,
        targetResource: input.target.targetResourceCode
      },
      claims: {
        sub: `agent:${agent.agentId}`,
        aud: input.target.audience,
        agent_id: agent.agentId,
        target_resource: input.target.targetResourceCode,
        token_use: "target_access",
        delegation_type: "agent_as_self",
        external_context: input.externalContext
      },
      ttlSeconds: this.policy.resolveTokenTtl(connection.maxTokenTtlSeconds)
    });

    await this.persistAndAudit({
      brokerResult,
      subjectType: "agent",
      subjectId: agent.id,
      agentDbId: agent.id,
      target: input.target,
      requestId: input.requestId,
      payload: {
        connection_id: connection.connectionId,
        grant_id: grant.grantId,
        external_context_digest: externalContextDigest
      }
    });
    return this.tokenResponse(brokerResult);
  }

  private async exchangeForApplication(input: {
    appId: string;
    secretId?: string;
    target: ActiveTargetResource;
    externalContext?: Record<string, unknown>;
    requestId: string;
  }) {
    const application = await this.prisma.oAuthClient.findFirst({
      where: {
        clientId: input.appId,
        tenantId: this.config.tenantId,
        deletedAt: null
      },
      include: { secrets: true }
    });
    if (!application || application.status !== "active") {
      throw apiError(HttpStatus.FORBIDDEN, "invalid_application", "Application is invalid.");
    }

    const activeSecret = application.secrets.find((secret) => {
      if (input.secretId && secret.id !== input.secretId) {
        return false;
      }
      return secret.status === "active" && (!secret.expiresAt || secret.expiresAt.getTime() > Date.now());
    });
    if (!activeSecret) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_app_secret", "Application secret association is invalid.");
    }

    const connection = await this.policy.findConnection({
      principalType: "application",
      principalId: application.clientId,
      targetResource: input.target.targetResourceCode
    });
    if (!connection) {
      throw apiError(HttpStatus.FORBIDDEN, "connection_not_allowed", "Target connection is not available for this principal.");
    }

    this.policy.assertExternalContextPolicy(connection, input.externalContext);
    const grant = await this.requireGrant(connection.id);
    const externalContextDigest = input.externalContext ? digestJson(input.externalContext) : undefined;
    const brokerResult = await this.broker.getOrIssue({
      context: {
        audience: input.target.audience,
        connectionId: connection.id,
        credentialId: activeSecret.id,
        grantId: grant.id,
        externalContextDigest,
        principalId: application.clientId,
        principalType: "application",
        targetId: input.target.id,
        targetResource: input.target.targetResourceCode
      },
      claims: {
        sub: `app:${application.clientId}`,
        aud: input.target.audience,
        app_id: application.clientId,
        target_resource: input.target.targetResourceCode,
        token_use: "target_access",
        external_context: input.externalContext
      },
      ttlSeconds: this.policy.resolveTokenTtl(connection.maxTokenTtlSeconds)
    });

    await this.persistAndAudit({
      brokerResult,
      subjectType: "application",
      subjectId: application.id,
      target: input.target,
      requestId: input.requestId,
      payload: {
        connection_id: connection.connectionId,
        grant_id: grant.grantId,
        external_context_digest: externalContextDigest
      }
    });
    return this.tokenResponse(brokerResult);
  }

  private async requireGrant(connectionId: string) {
    const grant = await this.policy.findActiveGrant(connectionId);
    if (!grant) {
      throw apiError(HttpStatus.FORBIDDEN, "access_not_allowed", "Access grant is not available for this target connection.");
    }
    return grant;
  }

  private async recordConnectionDenied(
    agentDbId: string,
    agentId: string,
    input: { target: ActiveTargetResource; requestId?: string; runtimeId?: string },
  ) {
    await this.audit.record({
      eventType: "target_token.connection_denied",
      result: "denied",
      requestId: input.requestId,
      agentId: agentDbId,
      targetResource: input.target.targetResourceCode,
      errorCode: "connection_not_allowed",
      payload: { agent_id: agentId, runtime_id: input.runtimeId }
    });
    this.metrics.increment("target_token.exchange", {
      result: "connection_not_allowed",
      target_resource: input.target.targetResourceCode
    });
  }

  private async persistAndAudit(input: {
    brokerResult: TargetTokenBrokerResult;
    subjectType: IssuedSubjectType;
    subjectId: string;
    agentDbId?: string;
    target: ActiveTargetResource;
    requestId?: string;
    payload?: Record<string, unknown>;
  }) {
    if (input.brokerResult.cache !== "hit") {
      await this.prisma.oAuthAccessTokenRecord.create({
        data: {
          tenantId: this.config.tenantId,
          jti: input.brokerResult.jti,
          tokenType: "target_access_token",
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          audience: input.target.audience,
          scope: "target_access",
          claimsJson: { target_resource: input.target.targetResourceCode },
          expiresAt: input.brokerResult.expiresAt
        }
      });
    }

    await this.audit.record({
      eventType: input.brokerResult.cache === "hit" ? "target_token.cache_hit" : "target_token.issue",
      result: "success",
      requestId: input.requestId,
      agentId: input.agentDbId,
      targetResource: input.target.targetResourceCode,
      payload: {
        ...input.payload,
        cache: input.brokerResult.cache,
        jti: input.brokerResult.jti,
        subject_kind: input.subjectType
      }
    });
    this.metrics.increment("target_token.exchange", {
      cache: input.brokerResult.cache,
      result: "success",
      subject_kind: input.subjectType,
      target_resource: input.target.targetResourceCode
    });
  }

  private tokenResponse(brokerResult: TargetTokenBrokerResult): TokenResponse {
    return {
      access_token: brokerResult.access_token,
      token_type: brokerResult.token_type,
      expires_in: brokerResult.expires_in,
      issued_token_type: brokerResult.issued_token_type,
      cache: brokerResult.cache,
      jti: brokerResult.jti
    };
  }
}

function readRequiredString(value: unknown, code: string, message: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw apiError(HttpStatus.UNAUTHORIZED, code, message);
  }
  return value.trim();
}

function getApiErrorCode(error: unknown) {
  if (typeof error === "object" && error && "getResponse" in error) {
    const response = (error as { getResponse: () => unknown }).getResponse();
    if (typeof response === "object" && response && "code" in response) {
      return String((response as { code: unknown }).code);
    }
  }
  return "internal_error";
}

function isInvalidJwtError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return [
    "ERR_JWS_INVALID",
    "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    "ERR_JWT_EXPIRED",
    "ERR_JWT_CLAIM_VALIDATION_FAILED",
    "ERR_JWKS_INVALID"
  ].includes((error as Error & { code?: string }).code ?? "") || error.message.includes("JWT");
}
