import { HttpStatus, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { AppConfigService } from "../../shared/config/app-config.service";
import { apiError } from "../../shared/http/http-errors";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { AuditService } from "../../shared/audit/audit.service";
import { RateLimitService } from "../../shared/rate-limit/rate-limit.service";
import { TokenSignerService } from "../../shared/security/token-signer.service";
import { HashService } from "../../shared/security/hash.service";
import { CallerCredentialService } from "./caller-credential.service";
import { DelegationPolicyService } from "./delegation-policy.service";

@Injectable()
export class RequesterTokenService {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly callerCredentials: CallerCredentialService,
    private readonly audit: AuditService,
    private readonly rateLimit: RateLimitService,
    private readonly tokenSigner: TokenSignerService,
    private readonly hashes: HashService,
    private readonly policy: DelegationPolicyService,
  ) {}

  async issue(
    request: FastifyRequest,
    input: {
      grantType: string;
      principalType: "agent" | "application";
      agentId?: string;
      appId?: string;
      runtimeId?: string;
      targetResource: string;
      externalContext?: Record<string, unknown>;
    },
  ) {
    if (input.grantType !== "urn:authany:params:oauth:grant-type:requester-token") {
      throw apiError(HttpStatus.BAD_REQUEST, "unsupported_grant_type", "Requester token grant type is invalid.");
    }

    if (input.principalType === "application") {
      return this.issueApplication(request, input);
    }
    return this.issueAgent(request, input);
  }

  private async issueAgent(
    request: FastifyRequest,
    input: {
      agentId?: string;
      runtimeId?: string;
      targetResource: string;
      externalContext?: Record<string, unknown>;
    },
  ) {
    const agentId = readRequiredBodyString(input.agentId, "invalid_agent", "Agent ID is required.");
    await this.rateLimit.assertAllowed({
      key: `requester-token:agent:${agentId}`,
      limit: 120,
      windowSeconds: 60,
      metricName: "requester_token.issue.rate_limit"
    });

    try {
      const authenticated = await this.callerCredentials.authenticateAgentSecret(request, {
        agentId,
        runtimeId: input.runtimeId
      });
      await this.policy.requireActiveTargetResource(input.targetResource);
      const signed = await this.tokenSigner.signWithMetadata({
        sub: `agent:${authenticated.agent.agentId}`,
        agent_id: authenticated.agent.agentId,
        runtime_id: authenticated.runtime?.runtimeId,
        target_resource: input.targetResource,
        request_id: randomUUID(),
        credential_id: authenticated.credential.id,
        external_context: input.externalContext,
        token_use: "requester_assertion"
      }, {
        audience: this.config.baseUrl,
        expiresInSeconds: 300
      });
      await this.audit.record({
        eventType: "requester_token.issue",
        result: "success",
        agentId: authenticated.agent.id,
        targetResource: input.targetResource,
        payload: { principal_type: "agent", runtime_id: authenticated.runtime?.runtimeId }
      });
      return requesterTokenResponse(signed.token, signed.expiresAt);
    } catch (error) {
      await this.auditFailure("agent", agentId, input.targetResource, getApiErrorCode(error));
      throw error;
    }
  }

  private async issueApplication(
    request: FastifyRequest,
    input: {
      appId?: string;
      targetResource: string;
      externalContext?: Record<string, unknown>;
    },
  ) {
    const appId = readRequiredBodyString(input.appId, "invalid_application", "App ID is required.");
    await this.rateLimit.assertAllowed({
      key: `requester-token:application:${appId}`,
      limit: 120,
      windowSeconds: 60,
      metricName: "requester_token.issue.rate_limit"
    });

    try {
      const secretValue = readBearerToken(request, "invalid_app_secret", "Application secret is missing.");
      const application = await this.prisma.oAuthClient.findFirst({
        where: {
          clientId: appId,
          tenantId: this.config.tenantId,
          deletedAt: null
        },
        include: { secrets: true }
      });
      if (!application || application.status !== "active") {
        throw apiError(HttpStatus.FORBIDDEN, "invalid_application", "Application is invalid.");
      }
      const activeSecret = application.secrets.find((item) => (
        item.status === "active" &&
        (!item.expiresAt || item.expiresAt.getTime() > Date.now()) &&
        this.hashes.verifySecret(secretValue, item.secretHash)
      ));
      if (!activeSecret) {
        throw apiError(HttpStatus.UNAUTHORIZED, "invalid_app_secret", "Application secret is invalid.");
      }
      await this.policy.requireActiveTargetResource(input.targetResource);
      const signed = await this.tokenSigner.signWithMetadata({
        sub: `app:${application.clientId}`,
        app_id: application.clientId,
        secret_id: activeSecret.id,
        target_resource: input.targetResource,
        request_id: randomUUID(),
        external_context: input.externalContext,
        token_use: "requester_assertion"
      }, {
        audience: this.config.baseUrl,
        expiresInSeconds: 300
      });
      await this.audit.record({
        eventType: "requester_token.issue",
        result: "success",
        clientId: application.id,
        targetResource: input.targetResource,
        payload: { principal_type: "application" }
      });
      return requesterTokenResponse(signed.token, signed.expiresAt);
    } catch (error) {
      await this.auditFailure("application", appId, input.targetResource, getApiErrorCode(error));
      throw error;
    }
  }

  private auditFailure(principalType: string, principalId: string, targetResource: string, errorCode: string) {
    return this.audit.record({
      eventType: "requester_token.issue",
      result: "denied",
      targetResource,
      errorCode,
      payload: { principal_type: principalType, principal_id: principalId }
    });
  }
}

function readRequiredBodyString(value: unknown, code: string, message: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw apiError(HttpStatus.BAD_REQUEST, code, message);
  }
  return value.trim();
}

function readBearerToken(request: FastifyRequest, code: string, message: string) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    throw apiError(HttpStatus.UNAUTHORIZED, code, message);
  }
  return token;
}

function requesterTokenResponse(token: string, expiresAt: Date) {
  return {
    requester_token: token,
    token_type: "Bearer",
    expires_in: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  };
}

function getApiErrorCode(error: unknown) {
  if (typeof error === "object" && error && "getResponse" in error) {
    const response = (error as { getResponse: () => unknown }).getResponse();
    if (typeof response === "object" && response && "code" in response) {
      return String((response as { code: unknown }).code);
    }
  }
  return "requester_token_failed";
}
