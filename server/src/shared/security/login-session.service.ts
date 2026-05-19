import { Injectable } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppConfigService } from "../config/app-config.service";
import { RedisService } from "../redis/redis.service";

interface LoginSessionPayload {
  operatorId: string;
  tenantId: string;
  expiresAt: number;
  bindingDigest: string;
}

export interface SessionBinding {
  ip?: string;
  userAgent?: string;
}

const SESSION_TTL_SECONDS = 8 * 60 * 60;

@Injectable()
export class LoginSessionService {
  constructor(
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
  ) {}

  async create(operatorId: string, binding: SessionBinding = {}) {
    const sessionId = randomBytes(32).toString("base64url");
    const payload: LoginSessionPayload = {
      operatorId,
      tenantId: this.config.tenantId,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
      bindingDigest: this.bindingDigest(binding)
    };
    await this.redis.set(this.sessionKey(sessionId), JSON.stringify(payload), SESSION_TTL_SECONDS);
    return sessionId;
  }

  async parse(cookieValue?: string | null, binding: SessionBinding = {}) {
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

    if (!matchesDigest(payload.bindingDigest, this.bindingDigest(binding))) {
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

  private bindingDigest(binding: SessionBinding) {
    const normalizedIp = normalizeBindingPart(binding.ip);
    const normalizedUserAgent = normalizeBindingPart(binding.userAgent);
    return createHmac("sha256", this.config.cookieSecret)
      .update(`${this.config.tenantId}\n${normalizedIp}\n${normalizedUserAgent}`)
      .digest("base64url");
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
    Number.isFinite(payload.expiresAt) &&
    typeof payload.bindingDigest === "string" &&
    payload.bindingDigest.length > 0
  );
}

function normalizeBindingPart(value: string | undefined) {
  return (value ?? "").trim().slice(0, 512);
}

function matchesDigest(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
