import { HttpStatus, Injectable } from "@nestjs/common";
import { apiError } from "../http/http-errors";
import { MetricsService } from "../metrics/metrics.service";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class RateLimitService {
  constructor(
    private readonly metrics: MetricsService,
    private readonly redis: RedisService,
  ) {}

  async assertAllowed(input: {
    key: string;
    limit: number;
    windowSeconds: number;
    metricName: string;
  }) {
    const limited = await this.hitRedis(input);
    if (!limited) {
      return;
    }
    this.metrics.increment(input.metricName, { result: "limited" });
    this.metrics.alert({
      type: "rate_limit.exceeded",
      severity: "warning",
      message: `Rate limit exceeded for ${input.key}.`,
      tags: { key: input.key }
    });
    throw apiError(HttpStatus.TOO_MANY_REQUESTS, "rate_limited", "Too many requests.");
  }

  private async hitRedis(input: {
    key: string;
    limit: number;
    windowSeconds: number;
  }) {
    const key = `rate_limit:${input.key}`;
    const raw = await this.redis.increment(key, input.windowSeconds);
    return raw > input.limit;
  }
}
