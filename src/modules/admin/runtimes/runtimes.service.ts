import { HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import { AppConfigService } from "../../../shared/config/app-config.service";
import { AdminBaseService } from "../shared/admin-base.service";
import { apiError } from "../../../shared/http/http-errors";
import { requireNonEmptyStrings } from "../shared/input-validation";

@Injectable()
export class RuntimesService extends AdminBaseService {
  constructor(prisma: PrismaService, config: AppConfigService) {
    super(prisma, config);
  }

  list(input: { agent_id?: string } = {}) {
    return this.prisma.runtimeRegistration.findMany({
      where: {
        tenantId: this.config.tenantId,
        agent: input.agent_id ? { agentId: input.agent_id } : undefined
      },
      include: { agent: runtimeAgentInclude() },
      orderBy: { createdAt: "desc" }
    });
  }

  async get(id: string) {
    const runtime = await this.prisma.runtimeRegistration.findFirst({
      where: {
        id,
        tenantId: this.config.tenantId
      },
      include: {
        agent: runtimeAgentInclude(),
        connections: {
          include: {
            grants: true,
            target: true
          }
        },
        credentials: true
      }
    });
    if (!runtime) {
      throw apiError(HttpStatus.NOT_FOUND, "runtime_not_found", "Runtime registration was not found.");
    }
    return runtime;
  }

  async create(input: {
    agent_id: string;
    runtime_type: string;
    runtime_mode: string;
    allows_delegation_refresh?: boolean;
    allows_remote_cache_reuse?: boolean;
  }) {
    const values = requireNonEmptyStrings(input, [
      { key: "agent_id", label: "Agent ID" },
      { key: "runtime_type", label: "Runtime type" },
      { key: "runtime_mode", label: "Runtime mode" }
    ]);
    this.assertRefreshPolicy(values.runtime_mode, input.allows_delegation_refresh);
    const agent = await this.prisma.agentProfile.findFirst({
      where: {
        agentId: values.agent_id,
        tenantId: this.config.tenantId
      }
    });
    if (!agent) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_agent", "Agent does not exist.");
    }

    return this.prisma.runtimeRegistration.create({
      data: {
        tenantId: this.config.tenantId,
        runtimeId: await this.generateRuntimeId(),
        agentId: agent.id,
        runtimeType: values.runtime_type,
        runtimeMode: values.runtime_mode,
        status: "active",
        allowsDelegationRefresh: input.allows_delegation_refresh ?? false,
        allowsRemoteCacheReuse: input.allows_remote_cache_reuse ?? false
      }
    });
  }

  async update(id: string, input: {
    status?: string;
    runtime_mode?: string;
    allows_delegation_refresh?: boolean;
    allows_remote_cache_reuse?: boolean;
  }) {
    this.assertRefreshPolicy(input.runtime_mode, input.allows_delegation_refresh);
    await this.get(id);
    return this.prisma.runtimeRegistration.update({
      where: { id },
      data: {
        status: input.status,
        runtimeMode: input.runtime_mode,
        allowsDelegationRefresh: input.allows_delegation_refresh,
        allowsRemoteCacheReuse: input.allows_remote_cache_reuse
      }
    });
  }

  private assertRefreshPolicy(runtimeMode?: string, allowsDelegationRefresh?: boolean) {
    if (runtimeMode === "stateless" && allowsDelegationRefresh) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        "invalid_runtime_refresh_policy",
        "Stateless runtime cannot enable delegation refresh.",
      );
    }
  }

  private async generateRuntimeId() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const runtimeId = `rt_live_${randomBytes(18).toString("base64url")}`;
      const existing = await this.prisma.runtimeRegistration.findFirst({
        where: {
          runtimeId,
          tenantId: this.config.tenantId
        }
      });
      if (!existing) {
        return runtimeId;
      }
    }
    throw new Error("Unable to generate unique Runtime ID.");
  }
}

function runtimeAgentInclude() {
  return {
    select: {
      id: true,
      tenantId: true,
      agentId: true,
      name: true,
      status: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true
    }
  };
}
