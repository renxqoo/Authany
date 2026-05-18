import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { JWTPayload } from "jose";
import { AppConfigService } from "../../shared/config/app-config.service";
import { RedisService } from "../../shared/redis/redis.service";
import { TokenSignerService } from "../../shared/security/token-signer.service";
import { SecretEncryptionService } from "../../shared/security/secret-encryption.service";
import { stableJsonStringify } from "../../shared/utils/stable-json";

export interface TargetTokenBrokerContext {
  principalType: "agent" | "application";
  principalId: string;
  audience: string;
  connectionId: string;
  credentialId?: string | null;
  grantId: string;
  runtimeId?: string | null;
  targetId: string;
  targetResource: string;
  externalContextDigest?: string | null;
}

interface CachedTargetToken {
  access_token: string;
  expires_at: number;
  issued_token_type: string;
  jti: string;
  token_type: "Bearer";
  version: 1;
}

type CacheReadResult =
  | { kind: "hit"; value: CachedTargetToken }
  | { kind: "miss" }
  | { kind: "backend_error" };

export interface TargetTokenBrokerResult {
  access_token: string;
  cache: "hit" | "miss" | "backend_error";
  expiresAt: Date;
  expires_in: number;
  issued_token_type: string;
  jti: string;
  token_type: "Bearer";
}

@Injectable()
export class TargetTokenBrokerService {
  constructor(
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
    private readonly tokenSigner: TokenSignerService,
    private readonly secrets: SecretEncryptionService,
  ) {}

  async getOrIssue(input: {
    context: TargetTokenBrokerContext;
    claims: JWTPayload;
    ttlSeconds: number;
  }): Promise<TargetTokenBrokerResult> {
    const cacheKey = this.cacheKey(input.context);
    const cached = await this.readReusable(cacheKey);
    if (cached.kind === "hit") {
      return {
        access_token: cached.value.access_token,
        cache: "hit",
        expiresAt: new Date(cached.value.expires_at),
        expires_in: secondsUntil(cached.value.expires_at),
        issued_token_type: cached.value.issued_token_type,
        jti: cached.value.jti,
        token_type: cached.value.token_type
      };
    }

    const signed = await this.tokenSigner.signWithMetadata(input.claims, {
      audience: input.context.audience,
      expiresInSeconds: input.ttlSeconds
    });
    const value: CachedTargetToken = {
      access_token: signed.token,
      expires_at: signed.expiresAt.getTime(),
      issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
      jti: signed.jti,
      token_type: "Bearer",
      version: 1
    };
    const cacheWriteSucceeded = await this.write(cacheKey, value);

    return {
      access_token: signed.token,
      cache: cached.kind === "backend_error" || !cacheWriteSucceeded ? "backend_error" : "miss",
      expiresAt: signed.expiresAt,
      expires_in: input.ttlSeconds,
      issued_token_type: value.issued_token_type,
      jti: signed.jti,
      token_type: "Bearer"
    };
  }

  private async readReusable(cacheKey: string) {
    const raw = await this.safeGet(cacheKey);
    if (raw === "backend_error") {
      return { kind: "backend_error" } satisfies CacheReadResult;
    }
    if (!raw) {
      return { kind: "miss" } satisfies CacheReadResult;
    }

    const parsed = parseCachedToken(this.decryptCacheValue(raw));
    if (!parsed) {
      await this.safeDelete(cacheKey);
      return { kind: "miss" } satisfies CacheReadResult;
    }

    const remainingMs = parsed.expires_at - Date.now();
    if (remainingMs <= this.config.targetTokenReuseThresholdSeconds * 1000) {
      await this.safeDelete(cacheKey);
      return { kind: "miss" } satisfies CacheReadResult;
    }

    return { kind: "hit", value: parsed } satisfies CacheReadResult;
  }

  private async write(cacheKey: string, value: CachedTargetToken) {
    const ttlSeconds = Math.max(1, secondsUntil(value.expires_at));
    return this.safeSet(cacheKey, this.secrets.encryptJson(value), ttlSeconds);
  }

  private cacheKey(context: TargetTokenBrokerContext) {
    const stableContext = {
      audience: context.audience,
      connectionId: context.connectionId,
      credentialId: context.credentialId ?? "",
      externalContextDigest: context.externalContextDigest ?? "",
      grantId: context.grantId,
      principalId: context.principalId,
      principalType: context.principalType,
      runtimeId: context.runtimeId ?? "",
      targetId: context.targetId,
      targetResource: context.targetResource,
      tenantId: this.config.tenantId
    };
    const digest = createHash("sha256")
      .update(stableJsonStringify(stableContext))
      .digest("base64url");
    return `target_token:${this.config.tenantId}:${digest}`;
  }

  private async safeGet(cacheKey: string) {
    try {
      return await this.redis.get(cacheKey);
    } catch {
      return "backend_error" as const;
    }
  }

  private async safeSet(cacheKey: string, value: string, ttlSeconds: number) {
    try {
      await this.redis.set(cacheKey, value, ttlSeconds);
      return true;
    } catch {
      return false;
    }
  }

  private async safeDelete(cacheKey: string) {
    try {
      await this.redis.delete(cacheKey);
    } catch {
      // Stale cache cleanup is best-effort; the next read still has to pass authorization first.
    }
  }

  private decryptCacheValue(raw: string) {
    try {
      return JSON.stringify(this.secrets.decryptJson(raw));
    } catch {
      return raw;
    }
  }
}

function parseCachedToken(raw: string): CachedTargetToken | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CachedTargetToken>;
    if (
      parsed.version !== 1 ||
      parsed.token_type !== "Bearer" ||
      typeof parsed.access_token !== "string" ||
      typeof parsed.expires_at !== "number" ||
      typeof parsed.issued_token_type !== "string" ||
      typeof parsed.jti !== "string"
    ) {
      return null;
    }
    return parsed as CachedTargetToken;
  } catch {
    return null;
  }
}

function secondsUntil(timestampMs: number) {
  return Math.max(0, Math.floor((timestampMs - Date.now()) / 1000));
}
