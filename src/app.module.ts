import { Module } from "@nestjs/common";
import { HealthModule } from "./shared/health/health.module";
import { AppConfigModule } from "./shared/config/app-config.module";
import { PrismaModule } from "./shared/prisma/prisma.module";
import { RedisModule } from "./shared/redis/redis.module";
import { SecurityModule } from "./shared/security/security.module";

@Module({
  imports: [AppConfigModule, PrismaModule, RedisModule, SecurityModule, HealthModule]
})
export class AppModule {}
