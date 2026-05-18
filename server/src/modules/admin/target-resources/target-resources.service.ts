import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import { AppConfigService } from "../../../shared/config/app-config.service";
import { AdminBaseService } from "../shared/admin-base.service";
import { AuditService } from "../../../shared/audit/audit.service";
import { optionalString, requireNonEmptyStrings } from "../shared/input-validation";
import { apiError } from "../../../shared/http/http-errors";

@Injectable()
export class TargetResourcesService extends AdminBaseService {
  constructor(
    prisma: PrismaService,
    config: AppConfigService,
    private readonly audit: AuditService,
  ) {
    super(prisma, config);
  }

  async list() {
    const targets = await this.prisma.targetResourceRegistration.findMany({
      where: { tenantId: this.config.tenantId },
      orderBy: { createdAt: "desc" }
    });
    return targets.map((target) => this.withTrustMetadata(target));
  }

  async get(id: string) {
    const target = await this.prisma.targetResourceRegistration.findFirst({
      where: {
        id,
        tenantId: this.config.tenantId
      },
      include: {
        connections: {
          include: {
            grants: true,
            runtime: true
          }
        }
      }
    });
    if (!target) {
      throw apiError(HttpStatus.NOT_FOUND, "target_resource_not_found", "Target resource was not found.");
    }
    return this.withTrustMetadata(target);
  }

  async create(input: {
    target_resource_code: string;
    display_name: string;
    audience: string;
    token_validation_mode: string;
    trust_config_json: Record<string, unknown>;
  }) {
    const values = requireNonEmptyStrings(input, [
      { key: "target_resource_code", label: "Target resource code" },
      { key: "display_name", label: "Display name" },
      { key: "audience", label: "Audience" },
      { key: "token_validation_mode", label: "Token validation mode" }
    ]);
    const trustConfig = normalizeTrustConfig(input.trust_config_json);
    await this.ensureAudienceUnique(values.audience);
    const target = await this.prisma.targetResourceRegistration.create({
      data: {
        tenantId: this.config.tenantId,
        targetResourceCode: values.target_resource_code,
        displayName: values.display_name,
        audience: values.audience,
        status: "active",
        tokenValidationMode: normalizeTokenValidationMode(values.token_validation_mode),
        trustConfigJson: trustConfig as Prisma.InputJsonValue
      }
    });
    await this.audit.record({
      eventType: "admin.target_resource.create",
      result: "success",
      targetResource: values.target_resource_code,
      payload: { audience: values.audience }
    });
    return this.withTrustMetadata(target);
  }

  async update(id: string, input: {
    display_name?: string;
    status?: string;
    audience?: string;
    token_validation_mode?: string;
    trust_config_json?: Record<string, unknown>;
  }) {
    const current = await this.get(id);
    if (input.audience && input.audience !== current.audience) {
      await this.ensureAudienceUnique(input.audience, id);
    }
    const target = await this.prisma.targetResourceRegistration.update({
      where: { id },
      data: {
        displayName: input.display_name,
        status: input.status,
        audience: input.audience,
        tokenValidationMode: input.token_validation_mode === undefined ? undefined : normalizeTokenValidationMode(input.token_validation_mode),
        trustConfigJson: input.trust_config_json === undefined ? undefined : normalizeTrustConfig(input.trust_config_json) as Prisma.InputJsonValue
      }
    });
    await this.audit.record({
      eventType: "admin.target_resource.update",
      result: "success",
      targetResource: target.targetResourceCode,
      payload: { status: input.status, audience: input.audience }
    });
    return this.withTrustMetadata(target);
  }

  private withTrustMetadata<T extends { audience: string; tokenValidationMode?: string }>(target: T) {
    return {
      ...target,
      trust_metadata: {
        issuer: this.config.baseUrl,
        audience: target.audience,
        jwks_uri: `${this.config.baseUrl}/.well-known/jwks.json`,
        introspection_endpoint: `${this.config.baseUrl}/oauth/introspect`,
        token_validation_mode: target.tokenValidationMode
      }
    };
  }

  private async ensureAudienceUnique(audience: string, excludeId?: string) {
    const existing = await this.prisma.targetResourceRegistration.findFirst({
      where: {
        tenantId: this.config.tenantId,
        audience,
        id: excludeId ? { not: excludeId } : undefined,
        status: "active"
      }
    });
    if (existing) {
      throw apiError(HttpStatus.BAD_REQUEST, "duplicate_target_audience", "Audience must be unique among active target resources.");
    }
  }
}

function normalizeTokenValidationMode(value: string) {
  const normalized = optionalString(value);
  if (normalized !== "jwks" && normalized !== "introspection") {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_token_validation_mode", "Token validation mode is invalid.");
  }
  return normalized;
}

function normalizeTrustConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_trust_config", "Trust config must be a JSON object.");
  }
  return value as Record<string, unknown>;
}
