import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get("/health")
  live() {
    return { status: "ok" };
  }

  @Get("/ready")
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    const db = await this.prisma.healthcheck();
    const redis = await this.redis.healthcheck();
    const ready = db && redis;
    reply.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: ready ? "ready" : "degraded",
      checks: { db, redis }
    };
  }
}
