import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AppConfigService } from "../config/app-config.service";

interface AuditInput {
  eventType: string;
  result: string;
  requestId?: string;
  operatorId?: string | null;
  clientId?: string | null;
  agentId?: string | null;
  targetResource?: string | null;
  errorCode?: string | null;
  payload?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async record(input: AuditInput) {
    await this.prisma.auditEvent.create({
      data: {
        tenantId: this.config.tenantId,
        eventType: input.eventType,
        result: input.result,
        requestId: input.requestId,
        operatorId: input.operatorId ?? undefined,
        clientId: input.clientId ?? undefined,
        agentId: input.agentId ?? undefined,
        targetResource: input.targetResource ?? undefined,
        errorCode: input.errorCode ?? undefined,
        payloadJson: (input.payload as Prisma.InputJsonValue | undefined) ?? undefined
      }
    });
  }
}
