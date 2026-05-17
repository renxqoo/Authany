import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../../../shared/admin/admin-auth.guard";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import { AppConfigService } from "../../../shared/config/app-config.service";
import { ListAuditEventsDto } from "./audit-events.dto";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin/audit-events")
export class AuditEventsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  list(@Query() query: ListAuditEventsDto) {
    return this.prisma.auditEvent.findMany({
      where: {
        tenantId: this.config.tenantId,
        eventType: query.event_type?.trim() || undefined,
        operatorId: query.operator_id?.trim() || undefined,
        agentId: query.agent_id?.trim() || undefined,
        targetResource: query.target_resource?.trim() || undefined,
        occurredAt: query.from || query.to
          ? {
            gte: query.from ? new Date(query.from) : undefined,
            lte: query.to ? new Date(query.to) : undefined
          }
          : undefined
      },
      orderBy: { occurredAt: "desc" },
      take: query.limit ?? 100,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined
    });
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.prisma.auditEvent.findUniqueOrThrow({
      where: { id },
      include: {
        operator: true,
        agent: true
      }
    });
  }
}
