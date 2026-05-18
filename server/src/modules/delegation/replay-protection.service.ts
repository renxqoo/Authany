import { HttpStatus, Injectable } from "@nestjs/common";
import { RedisService } from "../../shared/redis/redis.service";
import { AppConfigService } from "../../shared/config/app-config.service";
import { apiError } from "../../shared/http/http-errors";
import { MetricsService } from "../../shared/metrics/metrics.service";

@Injectable()
export class ReplayProtectionService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async assertNotReplayed(requestId?: string) {
    if (!requestId) {
      return;
    }

    const key = `replay:${this.config.tenantId}:${requestId}`;
    let accepted = false;
    try {
      accepted = await this.redis.setIfAbsent(key, "1", this.config.replayTtlSeconds);
    } catch {
      this.metrics.increment("delegation.replay", { result: "backend_error" });
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, "replay_protection_unavailable", "Replay protection is unavailable.");
    }
    if (!accepted) {
      this.metrics.increment("delegation.replay", { result: "blocked" });
      throw apiError(HttpStatus.UNAUTHORIZED, "request_replayed", "Delegation request was replayed.");
    }
  }
}
