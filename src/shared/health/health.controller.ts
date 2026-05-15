import { Controller, Get } from "@nestjs/common";
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
  async ready() {
    const db = await this.prisma.healthcheck();
    const redis = await this.redis.healthcheck();

    return {
      status: db && redis ? "ready" : "degraded",
      checks: { db, redis }
    };
  }
}
