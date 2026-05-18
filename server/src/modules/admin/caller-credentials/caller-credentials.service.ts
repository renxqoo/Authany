import { HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import { AppConfigService } from "../../../shared/config/app-config.service";
import { HashService } from "../../../shared/security/hash.service";
import { apiError } from "../../../shared/http/http-errors";
import { AuditService } from "../../../shared/audit/audit.service";
import { optionalString } from "../shared/input-validation";

@Injectable()
export class CallerCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly hashes: HashService,
    private readonly audit: AuditService,
  ) {}

  async listForAgent(agentDbId: string) {
    await this.requireActiveAgent(agentDbId);
    return this.prisma.callerCredential.findMany({
      where: {
        agentId: agentDbId,
        tenantId: this.config.tenantId
      },
      orderBy: { issuedAt: "desc" }
    });
  }

  async createForAgent(agentDbId: string, input: { runtime_id?: string }) {
    const agent = await this.requireActiveAgent(agentDbId);

    const runtimeId = optionalString(input.runtime_id);
    const runtime = runtimeId
      ? await this.prisma.runtimeRegistration.findFirst({
        where: {
          runtimeId,
          agentId: agent.id,
          tenantId: this.config.tenantId,
          status: "active"
        }
      })
      : null;
    if (runtimeId && !runtime) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_runtime", "Runtime registration does not exist for this active agent.");
    }

    const secret = `cc_live_${randomBytes(32).toString("base64url")}`;
    const credential = await this.prisma.callerCredential.create({
      data: {
        tenantId: this.config.tenantId,
        agentId: agent.id,
        runtimeRegistrationId: runtime?.id,
        credentialType: "agent_secret",
        credentialHint: credentialHint(secret),
        secretHashOrPublicKeyRef: this.hashes.hashSecret(secret),
        status: "active"
      }
    });
    await this.audit.record({
      eventType: "admin.caller_credential.issue",
      result: "success",
      agentId: agent.id,
      payload: { credential_id: credential.id, runtime_id: runtime?.runtimeId }
    });

    return {
      credential,
      caller_credential: secret
    };
  }

  async revoke(id: string) {
    const existing = await this.prisma.callerCredential.findFirst({
      where: {
        id,
        tenantId: this.config.tenantId
      }
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, "caller_credential_not_found", "Caller credential was not found.");
    }
    const credential = await this.prisma.callerCredential.update({
      where: { id },
      data: {
        status: "revoked",
        revokedAt: new Date()
      }
    });
    await this.audit.record({
      eventType: "admin.caller_credential.revoke",
      result: "success",
      agentId: credential.agentId,
      payload: { credential_id: id }
    });
    return credential;
  }

  private async requireActiveAgent(agentDbId: string) {
    const agent = await this.prisma.agentProfile.findFirst({
      where: {
        id: agentDbId,
        tenantId: this.config.tenantId,
        deletedAt: null,
        status: "active"
      }
    });
    if (!agent) {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_agent", "Agent does not exist or is not active.");
    }
    return agent;
  }
}

function credentialHint(secret: string) {
  return `${secret.slice(0, 12)}...${secret.slice(-4)}`;
}
