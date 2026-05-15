import { Injectable } from "@nestjs/common";
import { generateKeyPairSync } from "node:crypto";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  AUTHANY_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),
  ADMIN_API_TOKEN: z.string().min(8),
  COOKIE_SECRET: z.string().min(8),
  TENANT_ID: z.string().min(1).default("default"),
  AUTHANY_JWT_PRIVATE_KEY_PEM: z.string().optional(),
  AUTHANY_JWT_PUBLIC_KEY_PEM: z.string().optional(),
  AUTHANY_LOGIN_COOKIE_NAME: z.string().min(1).default("authany_session"),
  AUTHANY_BINDING_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  AUTHANY_AUTH_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  AUTHANY_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  AUTHANY_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  AUTHANY_DELEGATION_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  AUTHANY_REPLAY_TTL_SECONDS: z.coerce.number().int().positive().default(300)
});

type EnvConfig = z.infer<typeof envSchema>;

@Injectable()
export class AppConfigService {
  private readonly env: EnvConfig;
  private readonly signingKeyPair: { privateKeyPem: string; publicKeyPem: string };

  constructor() {
    this.env = envSchema.parse(process.env);
    this.signingKeyPair = this.resolveSigningKeys();
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

  get adminApiToken() {
    return this.env.ADMIN_API_TOKEN;
  }

  get cookieSecret() {
    return this.env.COOKIE_SECRET;
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

  get delegationTokenTtlSeconds() {
    return this.env.AUTHANY_DELEGATION_TOKEN_TTL_SECONDS;
  }

  get bindingTtlSeconds() {
    return this.env.AUTHANY_BINDING_TTL_SECONDS;
  }

  get replayTtlSeconds() {
    return this.env.AUTHANY_REPLAY_TTL_SECONDS;
  }

  get jwtPrivateKeyPem() {
    return this.signingKeyPair.privateKeyPem;
  }

  get jwtPublicKeyPem() {
    return this.signingKeyPair.publicKeyPem;
  }

  private resolveSigningKeys() {
    const privateKeyPem = this.env.AUTHANY_JWT_PRIVATE_KEY_PEM;
    const publicKeyPem = this.env.AUTHANY_JWT_PUBLIC_KEY_PEM;
    if (privateKeyPem && publicKeyPem) {
      return { privateKeyPem, publicKeyPem };
    }

    const generated = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" }
    });

    return {
      privateKeyPem: generated.privateKey,
      publicKeyPem: generated.publicKey
    };
  }
}
