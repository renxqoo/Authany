import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AppConfigService } from "../config/app-config.service";
import { RedisService } from "../redis/redis.service";

interface LoginSessionPayload {
  operatorId: string;
  tenantId: string;
  expiresAt: number;
}

const SESSION_TTL_SECONDS = 8 * 60 * 60;

@Injectable()
export class LoginSessionService {
  constructor(
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
  ) {}

  async create(operatorId: string) {
    const sessionId = randomBytes(32).toString("base64url");
    const payload: LoginSessionPayload = {
      operatorId,
      tenantId: this.config.tenantId,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
    };
    await this.redis.set(this.sessionKey(sessionId), JSON.stringify(payload), SESSION_TTL_SECONDS);
    return sessionId;
  }

  async parse(cookieValue?: string | null) {
    if (!cookieValue || !isValidSessionId(cookieValue)) {
      return null;
    }

    const raw = await this.redis.get(this.sessionKey(cookieValue));
    if (!raw) {
      return null;
    }

    let payload: LoginSessionPayload;
    try {
      payload = JSON.parse(raw) as LoginSessionPayload;
    } catch {
      await this.redis.delete(this.sessionKey(cookieValue));
      return null;
    }

    if (!isSessionPayload(payload, this.config.tenantId) || payload.expiresAt < Date.now()) {
      await this.redis.delete(this.sessionKey(cookieValue));
      return null;
    }

    return payload;
  }

  async revoke(sessionId?: string | null) {
    if (!sessionId || !isValidSessionId(sessionId)) {
      return;
    }
    await this.redis.delete(this.sessionKey(sessionId));
  }

  private sessionKey(sessionId: string) {
    return `auth:session:${this.config.tenantId}:${sessionId}`;
  }
}

function isValidSessionId(value: string) {
  return value.length >= 32 && /^[A-Za-z0-9_-]+$/.test(value);
}

function isSessionPayload(value: unknown, tenantId: string): value is LoginSessionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<LoginSessionPayload>;
  return (
    typeof payload.operatorId === "string" &&
    payload.operatorId.trim() !== "" &&
    payload.tenantId === tenantId &&
    typeof payload.expiresAt === "number" &&
    Number.isFinite(payload.expiresAt)
  );
}
