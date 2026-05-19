import { Injectable } from "@nestjs/common";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive().default(3100),
  AUTHANY_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  TENANT_ID: z.string().min(1),
  AUTHANY_APP_SECRET_ENCRYPTION_KEY: z.string().min(32),
  AUTHANY_LOGIN_COOKIE_NAME: z.string().min(1).default("authany_session"),
  AUTHANY_AUTH_CODE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
  AUTHANY_ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
  AUTHANY_REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(2592000),
  AUTHANY_TARGET_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),
  AUTHANY_TARGET_TOKEN_REUSE_THRESHOLD_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(60),
  AUTHANY_REPLAY_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  AUTHANY_CSP_FORM_ACTION_ORIGINS: z.string().default(""),
  AUTHANY_CORS_ORIGINS: z.string().default(""),
  AUTHANY_TRUSTED_PROXIES: z.string().default(""),
});

type EnvConfig = z.infer<typeof envSchema>;

@Injectable()
export class AppConfigService {
  private readonly env: EnvConfig;

  constructor() {
    this.env = envSchema.parse(process.env);
    this.assertProductionSecrets();
  }

  get nodeEnv() {
    return this.env.NODE_ENV;
  }

  get port() {
    return this.env.PORT;
  }

  get baseUrl() {
    return this.env.AUTHANY_BASE_URL;
  }

  get databaseUrl() {
    return this.env.DATABASE_URL;
  }

  get redisUrl() {
    return this.env.REDIS_URL;
  }

  get cookieSecret() {
    return this.env.COOKIE_SECRET;
  }

  get appSecretEncryptionKey() {
    return this.env.AUTHANY_APP_SECRET_ENCRYPTION_KEY;
  }

  get tenantId() {
    return this.env.TENANT_ID;
  }

  get loginCookieName() {
    return this.env.AUTHANY_LOGIN_COOKIE_NAME;
  }

  get authCodeTtlSeconds() {
    return this.env.AUTHANY_AUTH_CODE_TTL_SECONDS;
  }

  get accessTokenTtlSeconds() {
    return this.env.AUTHANY_ACCESS_TOKEN_TTL_SECONDS;
  }

  get refreshTokenTtlSeconds() {
    return this.env.AUTHANY_REFRESH_TOKEN_TTL_SECONDS;
  }

  get targetTokenTtlSeconds() {
    return this.env.AUTHANY_TARGET_TOKEN_TTL_SECONDS;
  }

  get targetTokenReuseThresholdSeconds() {
    return this.env.AUTHANY_TARGET_TOKEN_REUSE_THRESHOLD_SECONDS;
  }

  get replayTtlSeconds() {
    return this.env.AUTHANY_REPLAY_TTL_SECONDS;
  }

  get cspFormActionOrigins() {
    return parseOriginList(this.env.AUTHANY_CSP_FORM_ACTION_ORIGINS);
  }

  get corsOrigins() {
    return parseOriginList(this.env.AUTHANY_CORS_ORIGINS);
  }

  get secureCookies() {
    return this.env.NODE_ENV === "production";
  }

  get trustedProxies() {
    return this.env.AUTHANY_TRUSTED_PROXIES.split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private assertProductionSecrets() {
    if (this.env.NODE_ENV !== "production") {
      return;
    }
    const weakValues = new Set([
      "change-me-cookie-secret",
      "change-me-32-byte-app-secret-key",
      "admin-web-dev-secret-change-me",
      "demo-web-dev-secret-change-me",
    ]);
    if (weakValues.has(this.env.COOKIE_SECRET)) {
      throw new Error("COOKIE_SECRET must be a strong production secret.");
    }
    if (weakValues.has(this.env.AUTHANY_APP_SECRET_ENCRYPTION_KEY)) {
      throw new Error(
        "AUTHANY_APP_SECRET_ENCRYPTION_KEY must be a strong production secret.",
      );
    }
  }
}

function parseOriginList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => new URL(item).origin);
}
