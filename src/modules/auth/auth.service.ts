import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { HashService } from "../../shared/security/hash.service";
import { LoginSessionService } from "../../shared/security/login-session.service";
import { apiError } from "../../shared/http/http-errors";
import { RateLimitService } from "../../shared/rate-limit/rate-limit.service";
import { AppConfigService } from "../../shared/config/app-config.service";
import { AuditService } from "../../shared/audit/audit.service";
import { RedisService } from "../../shared/redis/redis.service";

const DUMMY_PASSWORD_HASH = "6e7a4c91f28f49590c4ba31ad53f7d64:e2f8138f01743f240a11e62c3f386b1b7e4a90db07d3666d532ec4fbb1634bbb3f2b8162ed48b2068d56b07ae71102838b8331574e443fa3279358666c3e75f";
const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60;
const LOGIN_LOCK_DURATION_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashes: HashService,
    private readonly sessions: LoginSessionService,
    private readonly rateLimit: RateLimitService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async login(username: string, password: string, context: { ip?: string; requestId?: string } = {}) {
    const normalizedUsername = username.trim();
    const normalizedUserKey = normalizedUsername.toLowerCase() || "unknown";
    await this.rateLimit.assertAllowed({
      key: `login:ip:${context.ip ?? "unknown"}`,
      limit: 10,
      windowSeconds: 60,
      metricName: "auth.login.rate_limit"
    });
    if (await this.isLocked(normalizedUserKey)) {
      await this.audit.record({
        eventType: "auth.login",
        result: "denied",
        requestId: context.requestId,
        errorCode: "account_locked",
        payload: { ip: context.ip, username: normalizedUsername }
      });
      throw apiError(HttpStatus.TOO_MANY_REQUESTS, "account_locked", "Too many failed login attempts. Try again later.");
    }

    const operator = await this.prisma.operatorAccount.findFirst({
      where: {
        tenantId: this.config.tenantId,
        username: normalizedUsername
      }
    });

    const passwordHash = operator?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = this.hashes.verifySecret(password, passwordHash);
    if (!operator || operator.status !== "active" || !passwordMatches) {
      const locked = await this.recordFailedLogin(normalizedUserKey);
      await this.audit.record({
        eventType: "auth.login",
        result: "denied",
        requestId: context.requestId,
        operatorId: operator?.id,
        errorCode: locked ? "account_locked" : "invalid_credentials",
        payload: { ip: context.ip, username: normalizedUsername }
      });
      if (locked) {
        await this.audit.record({
          eventType: "auth.login.locked",
          result: "denied",
          requestId: context.requestId,
          operatorId: operator?.id,
          errorCode: "account_locked",
          payload: { ip: context.ip, username: normalizedUsername }
        });
      }
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_credentials", "Username or password is invalid.");
    }

    await this.clearFailedLogins(normalizedUserKey);
    await this.audit.record({
      eventType: "auth.login",
      result: "success",
      requestId: context.requestId,
      operatorId: operator.id,
      payload: { ip: context.ip, username: operator.username }
    });
    return {
      operator,
      sessionCookie: await this.sessions.create(operator.id)
    };
  }

  private async isLocked(username: string) {
    return Boolean(await this.redis.get(this.lockKey(username)));
  }

  private async recordFailedLogin(username: string) {
    const failures = await this.redis.increment(this.failureKey(username), LOGIN_FAILURE_WINDOW_SECONDS);
    if (failures < LOGIN_LOCK_THRESHOLD) {
      return false;
    }
    await this.redis.set(this.lockKey(username), "1", LOGIN_LOCK_DURATION_SECONDS);
    await this.redis.delete(this.failureKey(username));
    return true;
  }

  private async clearFailedLogins(username: string) {
    await this.redis.delete(this.failureKey(username));
  }

  private failureKey(username: string) {
    return `auth:login:failure:${this.config.tenantId}:${username}`;
  }

  private lockKey(username: string) {
    return `auth:login:lock:${this.config.tenantId}:${username}`;
  }
}
