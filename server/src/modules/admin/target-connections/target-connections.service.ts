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
export class TargetConnectionsService extends AdminBaseService {
  constructor(
    prisma: PrismaService,
    config: AppConfigService,
    private readonly audit: AuditService,
  ) {
    super(prisma, config);
  }

  list() {
    return this.prisma.targetConnection.findMany({
      where: { tenantId: this.config.tenantId },
      include: { target: true, runtime: true, grants: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async get(id: string) {
    const connection = await this.prisma.targetConnection.findFirst({
      where: {
        id,
        tenantId: this.config.tenantId
      },
      include: {
        target: true,
        runtime: {
          include: {
            agent: true
          }
        },
        grants: true
      }
    });
    if (!connection) {
      throw apiError(HttpStatus.NOT_FOUND, "target_connection_not_found", "Target connection was not found.");
    }
    return connection;
  }

  async create(input: {
    connection_id?: string;
    principal_type: string;
    principal_id: string;
    runtime_id?: string;
    target_resource: string;
    external_context_mode: string;
    allowed_context_providers?: string[];
    max_token_ttl_seconds: number;
  }) {
    const values = requireNonEmptyStrings(input, [
      { key: "principal_type", label: "Principal type" },
      { key: "principal_id", label: "Principal ID" },
      { key: "target_resource", label: "Target resource" },
      { key: "external_context_mode", label: "External context mode" }
    ]);
    const principalType = normalizePrincipalType(values.principal_type);
    await this.assertPrincipalExists(principalType, values.principal_id);
    const target = await this.requireTarget(values.target_resource);
    const runtime = await this.resolveRuntime(optionalString(input.runtime_id), principalType, values.principal_id);
    const connectionId = optionalString(input.connection_id) ?? await this.generateConnectionId();
    const externalContextMode = normalizeExternalContextMode(values.external_context_mode);
    const allowedContextProviders = normalizeAllowedContextProviders(input.allowed_context_providers, externalContextMode);
    const connection = await this.prisma.targetConnection.create({
      data: {
        tenantId: this.config.tenantId,
        connectionId,
        principalType,
        principalId: values.principal_id,
        runtimeRegistrationId: runtime?.id,
        targetResourceId: target.id,
        targetResource: target.targetResourceCode,
        externalContextMode,
        allowedContextProvidersJson: allowedContextProviders as Prisma.InputJsonValue,
        maxTokenTtlSeconds: normalizeTtl(input.max_token_ttl_seconds),
        status: "active"
      }
    });
    await this.audit.record({
      eventType: "admin.target_connection.create",
      result: "success",
      targetResource: target.targetResourceCode,
      payload: { connection_id: connection.connectionId, principal_type: principalType, principal_id: values.principal_id }
    });
    return connection;
  }

  async update(id: string, input: {
    status?: string;
    external_context_mode?: string;
    allowed_context_providers?: string[];
    max_token_ttl_seconds?: number;
    expires_at?: string | null;
  }) {
    await this.get(id);
    const connection = await this.prisma.targetConnection.update({
      where: { id },
      data: {
        status: input.status === undefined ? undefined : normalizeStatus(input.status),
        externalContextMode: input.external_context_mode === undefined ? undefined : normalizeExternalContextMode(input.external_context_mode),
        allowedContextProvidersJson: input.allowed_context_providers === undefined ? undefined : normalizeStringArray(input.allowed_context_providers) as Prisma.InputJsonValue,
        maxTokenTtlSeconds: input.max_token_ttl_seconds === undefined ? undefined : normalizeTtl(input.max_token_ttl_seconds),
        expiresAt: input.expires_at === undefined ? undefined : input.expires_at ? new Date(input.expires_at) : null
      }
    });
    await this.audit.record({
      eventType: "admin.target_connection.update",
      result: "success",
      targetResource: connection.targetResource,
      payload: { connection_id: connection.connectionId, status: input.status }
    });
    return connection;
  }

  private async assertPrincipalExists(principalType: "agent" | "application" | "runtime", principalId: string) {
    if (principalType === "agent") {
      const agent = await this.prisma.agentProfile.findFirst({
        where: {
          agentId: principalId,
          tenantId: this.config.tenantId,
          deletedAt: null
        }
      });
      if (!agent) {
        throw apiError(HttpStatus.BAD_REQUEST, "invalid_principal", "Agent principal does not exist.");
      }
      return;
    }
    if (principalType === "runtime") {
      const runtime = await this.prisma.runtimeRegistration.findFirst({
        where: {
          runtimeId: principalId,
          tenantId: this.config.tenantId,
          status: "active"
        }
      });
      if (!runtime) {
        throw apiError(HttpStatus.BAD_REQUEST, "invalid_principal", "Runtime principal does not exist.");
      }
      return;
    }
    const app = await this.prisma.oAuthClient.findFirst({
      where: {
        clientId: principalId,
        tenantId: this.config.tenantId,
        deletedAt: null
      }
    });
    if (!app) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_principal", "Application principal does not exist.");
    }
  }

  private async requireTarget(targetResource: string) {
    const target = await this.prisma.targetResourceRegistration.findFirst({
      where: {
        targetResourceCode: targetResource,
        tenantId: this.config.tenantId,
        status: "active"
      }
    });
    if (!target) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_target_resource", "Target resource does not exist.");
    }
    return target;
  }

  private async resolveRuntime(runtimeId: string | undefined, principalType: "agent" | "application" | "runtime", principalId: string) {
    if (principalType === "runtime") {
      const runtime = await this.prisma.runtimeRegistration.findFirst({
        where: {
          runtimeId: principalId,
          tenantId: this.config.tenantId,
          status: "active"
        }
      });
      if (!runtime) {
        throw apiError(HttpStatus.BAD_REQUEST, "invalid_runtime", "Runtime registration does not exist.");
      }
      return runtime;
    }
    if (!runtimeId) {
      return null;
    }
    if (principalType !== "agent") {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_runtime", "Runtime can only be bound to an agent connection.");
    }
    const agent = await this.prisma.agentProfile.findFirst({
      where: {
        agentId: principalId,
        tenantId: this.config.tenantId
      }
    });
    const runtime = await this.prisma.runtimeRegistration.findFirst({
      where: {
        runtimeId,
        agentId: agent?.id,
        tenantId: this.config.tenantId,
        status: "active"
      }
    });
    if (!runtime) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_runtime", "Runtime registration does not exist for this agent.");
    }
    return runtime;
  }

  private async generateConnectionId() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const connectionId = `tc_live_${randomBytes(18).toString("base64url")}`;
      const existing = await this.prisma.targetConnection.findFirst({
        where: {
          connectionId,
          tenantId: this.config.tenantId
        }
      });
      if (!existing) {
        return connectionId;
      }
    }
    throw new Error("Unable to generate unique target connection ID.");
  }
}

function normalizePrincipalType(value: string) {
  return requireOneOf(value, ["agent", "application", "runtime"], "invalid_principal_type", "Principal type is invalid.") as "agent" | "application" | "runtime";
}

function normalizeExternalContextMode(value?: string) {
  return requireOneOf(optionalString(value) ?? "", ["optional", "required", "forbidden"], "invalid_external_context_mode", "External context mode is invalid.");
}

function normalizeStatus(value: string) {
  return requireOneOf(value, ["active", "inactive", "suspended", "deleted"], "invalid_connection_status", "Target connection status is invalid.");
}

function requireOneOf(value: string, allowed: string[], code: string, message: string) {
  const normalized = value.trim();
  if (!allowed.includes(normalized)) {
    throw apiError(HttpStatus.BAD_REQUEST, code, message);
  }
  return normalized;
}

function normalizeStringArray(value: unknown) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_string_array", "Value must be a string array.");
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_string_array", "Value must be a string array.");
    }
    return item.trim();
  });
}

function normalizeAllowedContextProviders(value: unknown, externalContextMode: string) {
  const providers = normalizeStringArray(value);
  if (externalContextMode !== "forbidden" && providers.length === 0) {
    throw apiError(
      HttpStatus.BAD_REQUEST,
      "invalid_allowed_context_providers",
      "Allowed context providers must be explicitly configured when external context is allowed or required.",
    );
  }
  return providers;
}

function normalizeTtl(value: unknown) {
  const ttl = Number(value);
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 10800) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_token_ttl", "Token TTL must be an integer from 60 to 10800 seconds.");
  }
  return ttl;
}
