import { HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import { AppConfigService } from "../../../shared/config/app-config.service";
import { AdminBaseService } from "../shared/admin-base.service";
import { AuditService } from "../../../shared/audit/audit.service";
import { optionalString, requireNonEmptyStrings } from "../shared/input-validation";
import { apiError } from "../../../shared/http/http-errors";

@Injectable()
export class AgentsService extends AdminBaseService {
  constructor(
    prisma: PrismaService,
    config: AppConfigService,
    private readonly audit: AuditService,
  ) {
    super(prisma, config);
  }

  async list(input: { q?: string; status?: string } = {}) {
    const agents = await this.prisma.agentProfile.findMany({
      where: {
        tenantId: this.config.tenantId,
        deletedAt: null,
        status: input.status || undefined
      },
      include: agentInclude(),
      orderBy: { updatedAt: "desc" }
    });
    const q = input.q?.trim().toLowerCase();
    return agents.map((agent) => this.toSummary(agent)).filter((agent) => {
      if (!q) {
        return true;
      }
      return [agent.name, agent.agent_id, agent.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }

  async create(input: { agent_id?: string; name: string; description?: string }) {
    const values = requireNonEmptyStrings(input, [{ key: "name", label: "Name" }]);
    const agentId = await this.generateAgentId();
    const agent = await this.prisma.agentProfile.create({
      data: {
        tenantId: this.config.tenantId,
        agentId,
        name: values.name,
        status: "active",
        description: optionalString(input.description)
      },
      include: agentInclude()
    });
    await this.audit.record({
      eventType: "admin.agent.create",
      result: "success",
      agentId: agent.id,
      payload: { agent_id: agentId }
    });
    return this.toDetail(agent);
  }

  async get(id: string) {
    const agent = await this.findActiveRecord(id);
    return this.toDetail(agent);
  }

  async update(id: string, input: { name?: string; status?: string; description?: string }) {
    await this.findActiveRecord(id);
    const agent = await this.prisma.agentProfile.update({
      where: { id },
      data: {
        name: input.name === undefined ? undefined : requireNonEmptyStrings({ name: input.name }, [{ key: "name", label: "Name" }]).name,
        status: input.status === undefined ? undefined : normalizeAgentStatus(input.status),
        description: input.description === undefined ? undefined : optionalString(input.description) ?? null
      },
      include: agentInclude()
    });
    await this.audit.record({
      eventType: "admin.agent.update",
      result: "success",
      agentId: id,
      payload: { status: input.status }
    });
    return this.toDetail(agent);
  }

  async delete(id: string, input: { confirm_name?: string }) {
    const agent = await this.findActiveRecord(id);
    if (input.confirm_name !== agent.name) {
      throw apiError(HttpStatus.BAD_REQUEST, "delete_confirmation_mismatch", "Agent name confirmation does not match.");
    }
    const deleted = await this.prisma.agentProfile.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "deleted",
        credentials: {
          updateMany: {
            where: { status: "active" },
            data: { status: "revoked", revokedAt: new Date() }
          }
        }
      },
      include: agentInclude()
    });
    await this.audit.record({
      eventType: "admin.agent.delete",
      result: "success",
      agentId: id,
      payload: { agent_id: agent.agentId }
    });
    return {
      id: deleted.id,
      status: deleted.status
    };
  }

  private async findActiveRecord(id: string) {
    const agent = await this.prisma.agentProfile.findFirst({
      where: {
        id,
        tenantId: this.config.tenantId,
        deletedAt: null
      },
      include: agentInclude()
    });
    if (!agent) {
      throw apiError(HttpStatus.NOT_FOUND, "agent_not_found", "Agent was not found.");
    }
    return agent;
  }

  private async generateAgentId() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const agentId = `agt_live_${randomBytes(18).toString("base64url")}`;
      const existing = await this.prisma.agentProfile.findFirst({
        where: {
          agentId,
          tenantId: this.config.tenantId
        }
      });
      if (!existing) {
        return agentId;
      }
    }
    throw new Error("Unable to generate unique Agent ID.");
  }

  private toSummary(agent: AgentRecord) {
    return {
      agent_id: agent.agentId,
      created_at: agent.createdAt,
      credential_count: agent.credentials.filter((credential) => credential.status === "active").length,
      description: agent.description,
      grant_count: activeGrantCount(agent),
      id: agent.id,
      name: agent.name,
      runtime_count: agent.runtimes.filter((runtime) => runtime.status === "active").length,
      status: agent.status,
      updated_at: agent.updatedAt
    };
  }

  private toDetail(agent: AgentRecord) {
    return {
      ...this.toSummary(agent),
      credentials: agent.credentials.map((credential) => ({
        credential_hint: credential.credentialHint,
        credential_type: credential.credentialType,
        expires_at: credential.expiresAt,
        id: credential.id,
        issued_at: credential.issuedAt,
        last_used_at: credential.lastUsedAt,
        revoked_at: credential.revokedAt,
        runtime_registration_id: credential.runtimeRegistrationId,
        status: credential.status
      })),
      runtimes: agent.runtimes.map((runtime) => ({
        allows_delegation_refresh: runtime.allowsDelegationRefresh,
        allows_remote_cache_reuse: runtime.allowsRemoteCacheReuse,
        credential_delivery_mode: runtime.credentialDeliveryMode,
        id: runtime.id,
        runtime_id: runtime.runtimeId,
        runtime_mode: runtime.runtimeMode,
        runtime_type: runtime.runtimeType,
        status: runtime.status,
        target_connections: (runtime.connections ?? []).map((connection) => ({
          connection_id: connection.connectionId,
          grant_count: connection.grants.filter((grant) => grant.status === "active").length,
          id: connection.id,
          status: connection.status,
          target_resource: connection.targetResource
        }))
      }))
    };
  }
}

type AgentRecord = Awaited<ReturnType<AgentsService["findActiveRecord"]>>;

function normalizeAgentStatus(value: string) {
  return requireOneOf(value, ["active", "inactive", "suspended", "deleted"], "invalid_agent_status", "Agent status is invalid.");
}

function requireOneOf(value: string, allowed: string[], code: string, message: string) {
  const normalized = value.trim();
  if (!allowed.includes(normalized)) {
    throw apiError(HttpStatus.BAD_REQUEST, code, message);
  }
  return normalized;
}

function agentInclude() {
  return {
    credentials: true,
    runtimes: {
      include: {
        connections: {
          include: { grants: true }
        }
      }
    }
  };
}

function activeGrantCount(agent: AgentRecord) {
  return agent.runtimes
    .flatMap((runtime) => runtime.connections ?? [])
    .flatMap((connection) => connection.grants ?? [])
    .filter((grant) => grant.status === "active").length;
}
