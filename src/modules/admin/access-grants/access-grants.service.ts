import { HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { AppConfigService } from "../../../shared/config/app-config.service";
import { apiError } from "../../../shared/http/http-errors";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import { AuditService } from "../../../shared/audit/audit.service";
import { optionalString, requireNonEmptyStrings } from "../shared/input-validation";
import { AdminBaseService } from "../shared/admin-base.service";

@Injectable()
export class AccessGrantsService extends AdminBaseService {
  constructor(
    prisma: PrismaService,
    config: AppConfigService,
    private readonly audit: AuditService,
  ) {
    super(prisma, config);
  }

  list() {
    return this.prisma.accessGrant.findMany({
      where: { tenantId: this.config.tenantId },
      include: { connection: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async get(id: string) {
    const grant = await this.prisma.accessGrant.findFirst({
      where: {
        id,
        tenantId: this.config.tenantId
      },
      include: {
        connection: {
          include: {
            target: true,
            runtime: {
              include: {
                agent: true
              }
            }
          }
        }
      }
    });
    if (!grant) {
      throw apiError(HttpStatus.NOT_FOUND, "access_grant_not_found", "Access grant was not found.");
    }
    return grant;
  }

  async create(input: {
    grant_id?: string;
    connection_id: string;
    grant_type: string;
    effect: string;
    constraints: Record<string, unknown>;
    expires_at: string;
  }) {
    const values = requireNonEmptyStrings(input, [
      { key: "connection_id", label: "Connection ID" },
      { key: "grant_type", label: "Grant type" },
      { key: "effect", label: "Effect" },
      { key: "expires_at", label: "Expires at" }
    ]);
    const connection = await this.requireConnection(values.connection_id);
    const constraints = normalizeConstraints(input.constraints);
    const grant = await this.prisma.accessGrant.create({
      data: {
        tenantId: this.config.tenantId,
        grantId: optionalString(input.grant_id) ?? await this.generateGrantId(),
        connectionId: connection.id,
        grantType: normalizeGrantType(values.grant_type),
        effect: normalizeEffect(values.effect),
        constraintsJson: constraints as Prisma.InputJsonValue,
        status: "active",
        expiresAt: parseFutureDate(values.expires_at, "invalid_expires_at", "Access grant expiry must be a valid future datetime.")
      }
    });
    await this.audit.record({
      eventType: "admin.access_grant.create",
      result: "success",
      targetResource: connection.targetResource,
      payload: { grant_id: grant.grantId, connection_id: connection.connectionId }
    });
    return grant;
  }

  async update(id: string, input: {
    status?: string;
    effect?: string;
    constraints?: Record<string, unknown>;
    expires_at?: string;
  }) {
    const current = await this.get(id);
    const grant = await this.prisma.accessGrant.update({
      where: { id },
      data: {
        status: input.status === undefined ? undefined : normalizeStatus(input.status),
        effect: input.effect === undefined ? undefined : normalizeEffect(input.effect),
        constraintsJson: input.constraints === undefined ? undefined : input.constraints as Prisma.InputJsonValue,
        expiresAt: input.expires_at === undefined
          ? undefined
          : parseFutureDate(input.expires_at, "invalid_expires_at", "Access grant expiry must be a valid future datetime.")
      }
    });
    await this.audit.record({
      eventType: "admin.access_grant.update",
      result: "success",
      targetResource: current.connection.targetResource,
      payload: { grant_id: grant.grantId, status: input.status }
    });
    return grant;
  }

  private async requireConnection(connectionId: string) {
    const connection = await this.prisma.targetConnection.findFirst({
      where: {
        connectionId,
        tenantId: this.config.tenantId,
        status: "active"
      }
    });
    if (!connection) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_target_connection", "Target connection does not exist.");
    }
    return connection;
  }

  private async generateGrantId() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const grantId = `ag_live_${randomBytes(18).toString("base64url")}`;
      const existing = await this.prisma.accessGrant.findFirst({
        where: {
          grantId,
          tenantId: this.config.tenantId
        }
      });
      if (!existing) {
        return grantId;
      }
    }
    throw new Error("Unable to generate unique access grant ID.");
  }
}

function normalizeEffect(value?: string) {
  return requireOneOf(optionalString(value) ?? "", ["allow"], "invalid_grant_effect", "Access grant effect is invalid.");
}

function normalizeGrantType(value: string) {
  return requireOneOf(value, ["target_access"], "invalid_grant_type", "Access grant type is invalid.");
}

function normalizeStatus(value: string) {
  return requireOneOf(value, ["active", "inactive", "revoked", "deleted"], "invalid_grant_status", "Access grant status is invalid.");
}

function normalizeConstraints(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_constraints", "Access grant constraints must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function parseFutureDate(value: string, code: string, message: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    throw apiError(HttpStatus.BAD_REQUEST, code, message);
  }
  return parsed;
}

function requireOneOf(value: string, allowed: string[], code: string, message: string) {
  const normalized = value.trim();
  if (!allowed.includes(normalized)) {
    throw apiError(HttpStatus.BAD_REQUEST, code, message);
  }
  return normalized;
}
