import { Module } from "@nestjs/common";
import { HealthModule } from "./shared/health/health.module";
import { AppConfigModule } from "./shared/config/app-config.module";
import { PrismaModule } from "./shared/prisma/prisma.module";
import { RedisModule } from "./shared/redis/redis.module";
import { SecurityModule } from "./shared/security/security.module";
import { AuditModule } from "./shared/audit/audit.module";
import { AdminModule } from "./shared/admin/admin.module";
import { MetricsModule } from "./shared/metrics/metrics.module";
import { RateLimitModule } from "./shared/rate-limit/rate-limit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OidcModule } from "./modules/oidc/oidc.module";
import { DelegationModule } from "./modules/delegation/delegation.module";
import { AdminApiModule } from "./modules/admin/admin.module";
import { TargetVerificationModule } from "./modules/target-verification/target-verification.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    SecurityModule,
    MetricsModule,
    RateLimitModule,
    AuditModule,
    AdminModule,
    AuthModule,
    OidcModule,
    DelegationModule,
    TargetVerificationModule,
    AdminApiModule,
    HealthModule
  ]
})
export class AppModule {}
