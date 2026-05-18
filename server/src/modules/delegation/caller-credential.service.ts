import { HttpStatus, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { AppConfigService } from "../../shared/config/app-config.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { apiError } from "../../shared/http/http-errors";
import { HashService } from "../../shared/security/hash.service";

@Injectable()
export class CallerCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly hashes: HashService,
  ) {}

  async requireActiveForAgent(input: {
    agentDbId: string;
    runtimeDbId?: string | null;
    credentialId?: string | null;
  }) {
    const now = new Date();
    const credential = await this.prisma.callerCredential.findFirst({
      where: {
        id: input.credentialId ?? undefined,
        tenantId: this.config.tenantId,
        agentId: input.agentDbId,
        runtimeRegistrationId: input.runtimeDbId ?? null,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      include: {
        agent: true,
        runtime: true
      }
    });

    if (!credential) {
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        "invalid_caller_credential",
        "Caller credential association is invalid.",
      );
    }

    return credential;
  }

  async authenticateAgentSecret(request: FastifyRequest, input: { agentId: string; runtimeId?: string }) {
    const token = readBearerToken(request);
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

    const credentials = await this.prisma.callerCredential.findMany({
      where: {
        tenantId: this.config.tenantId,
        agentId: agent.id,
        runtimeRegistrationId: runtime?.id ?? null,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      take: 10,
      include: { agent: true, runtime: true }
    });
    const credential = credentials.find((item) => this.hashes.verifySecret(token, item.secretHashOrPublicKeyRef));
    if (!credential) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_caller_credential", "Caller credential is invalid.");
    }
    return { agent, runtime, credential };
  }
}

function readBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    throw apiError(HttpStatus.UNAUTHORIZED, "invalid_caller_credential", "Caller credential is missing.");
  }
  return token;
}
