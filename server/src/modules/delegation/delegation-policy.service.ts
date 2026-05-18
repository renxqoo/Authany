import { HttpStatus, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { AppConfigService } from "../../shared/config/app-config.service";
import { apiError } from "../../shared/http/http-errors";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { stableJsonStringify } from "../../shared/utils/stable-json";
import type { ActiveTargetResource, PrincipalType } from "./delegation-types";

@Injectable()
export class DelegationPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async requireActiveTargetResource(targetResource: string): Promise<ActiveTargetResource> {
    const target = await this.prisma.targetResourceRegistration.findFirst({
	      where: {
	        tenantId: this.config.tenantId,
	        targetResourceCode: targetResource,
	        status: "active"
	      }
    });
    if (!target) {
      throw apiError(HttpStatus.FORBIDDEN, "invalid_target_resource", "Target resource is invalid.");
    }
    return target;
  }

  findConnection(input: {
    principalType: PrincipalType;
    principalId: string;
    targetResource: string;
    runtimeDbId?: string | null;
    runtimeId?: string | null;
  }) {
    const now = new Date();
    const activeWindow = [{ expiresAt: null }, { expiresAt: { gt: now } }];

    if (input.principalType === "agent") {
      return this.prisma.targetConnection.findFirst({
	        where: {
	          tenantId: this.config.tenantId,
	          targetResource: input.targetResource,
	          status: "active",
          OR: [
            {
              principalType: "agent",
              principalId: input.principalId,
              runtimeRegistrationId: input.runtimeDbId ?? null,
              OR: activeWindow
            },
            {
              principalType: "agent",
              principalId: input.principalId,
              runtimeRegistrationId: null,
              OR: activeWindow
            },
            ...(input.runtimeId ? [{
              principalType: "runtime",
              principalId: input.runtimeId,
              OR: activeWindow
            }] : [])
          ]
        },
        orderBy: { runtimeRegistrationId: "desc" }
      });
    }

    return this.prisma.targetConnection.findFirst({
      where: {
	        principalType: input.principalType,
	        principalId: input.principalId,
	        tenantId: this.config.tenantId,
	        targetResource: input.targetResource,
        status: "active",
        OR: activeWindow
      }
    });
  }

  findActiveGrant(connectionId: string) {
	    return this.prisma.accessGrant.findFirst({
	      where: {
	        connectionId,
	        tenantId: this.config.tenantId,
        effect: "allow",
        status: "active",
        expiresAt: { gt: new Date() }
      }
    });
  }

  assertExternalContextPolicy(
    connection: { externalContextMode: string; allowedContextProvidersJson: unknown },
    externalContext?: Record<string, unknown>,
  ) {
    if (connection.externalContextMode === "forbidden" && externalContext) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_external_context", "External context is not allowed for this connection.");
    }
    if (connection.externalContextMode === "required" && !externalContext) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_external_context", "External context is required for this connection.");
    }
    if (!externalContext) {
      return;
    }
    const provider = typeof externalContext.provider === "string" ? externalContext.provider : "";
    const allowedProviders = Array.isArray(connection.allowedContextProvidersJson)
      ? connection.allowedContextProvidersJson.map(String)
      : [];
    if (allowedProviders.length > 0 && !allowedProviders.includes(provider)) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_external_context", "External context provider is not allowed.");
    }
    if (JSON.stringify(externalContext).length > 4096) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_external_context", "External context is too large.");
    }
  }

  resolveTokenTtl(maxTokenTtlSeconds: number) {
    return Math.min(this.config.targetTokenTtlSeconds, maxTokenTtlSeconds);
  }
}

export function digestJson(value: Record<string, unknown>) {
  return createHash("sha256").update(stableJsonStringify(value)).digest("base64url");
}
