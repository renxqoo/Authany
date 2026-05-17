import { Injectable } from "@nestjs/common";
import { createPublicKey, randomUUID } from "node:crypto";
import { decodeProtectedHeader, exportJWK, importPKCS8, importSPKI, SignJWT, jwtVerify, type JWTPayload } from "jose";
import { AppConfigService } from "../config/app-config.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecretEncryptionService } from "./secret-encryption.service";

interface SigningKeyMaterial {
  kid: string;
  privateKeyPem: string;
  publicKeyPem: string;
}

@Injectable()
export class TokenSignerService {
  private readonly issuer: string;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly secrets: SecretEncryptionService,
  ) {
    this.issuer = config.baseUrl;
  }

  async sign(payload: JWTPayload, options: { audience?: string; expiresInSeconds: number }) {
    const result = await this.signWithMetadata(payload, options);
    return result.token;
  }

  async signWithMetadata(payload: JWTPayload, options: { audience?: string; expiresInSeconds: number }) {
    const signingKey = await this.getActiveSigningKey();
    const privateKey = await importPKCS8(signingKey.privateKeyPem, "RS256");
    const now = Math.floor(Date.now() / 1000);
    const audience = options.audience ?? payload.aud ?? this.issuer;
    const jti = randomUUID();
    const expiresAt = new Date((now + options.expiresInSeconds) * 1000);

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid: signingKey.kid, typ: "JWT" })
      .setIssuer(this.issuer)
      .setIssuedAt(now)
      .setJti(jti)
      .setExpirationTime(now + options.expiresInSeconds)
      .setAudience(audience)
      .sign(privateKey);

    return {
      token,
      jti,
      issuedAt: new Date(now * 1000),
      expiresAt
    };
  }

  async verify(token: string, audience?: string) {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "RS256") {
      throw new Error("Unsupported JWT algorithm.");
    }
    if (typeof header.kid !== "string" || header.kid.trim() === "") {
      throw new Error("JWT kid is required.");
    }
    const kid = header.kid;
    const publicKeyPem = await this.getVerificationPublicKey(kid);
    const publicKey = await importSPKI(publicKeyPem, "RS256");
    return jwtVerify(token, publicKey, {
      issuer: this.issuer,
      audience
    });
  }

  async getJwks() {
    const keyRecords = await this.loadUsableKeyRecords();
    if (keyRecords.length === 0) {
      throw new Error("No usable signing keys are available.");
    }
    const keys = await Promise.all(keyRecords.map(async (record) => {
      const publicKey = createPublicKey(this.readPublicKey(record.metadataJson));
      const jwk = await exportJWK(publicKey);
      return { ...jwk, alg: "RS256", kid: record.kid, use: "sig" };
    }));
    return { keys };
  }

  getIssuer() {
    return this.issuer;
  }

  private async getActiveSigningKey(): Promise<SigningKeyMaterial> {
    const activeRecord = await this.prisma.keyRotationRecord.findFirst({
      where: {
        tenantId: this.config.tenantId,
        algorithm: "RS256",
        status: "active"
      },
      orderBy: { activatedAt: "desc" }
    });

    if (!activeRecord) {
      throw new Error("No active signing key is available.");
    }

    return {
      kid: activeRecord.kid,
      privateKeyPem: this.readPrivateKey(activeRecord.metadataJson),
      publicKeyPem: this.readPublicKey(activeRecord.metadataJson)
    };
  }

  private async getVerificationPublicKey(kid?: string) {
    if (!kid) {
      throw new Error("Unknown JWT kid.");
    }

    const record = await this.prisma.keyRotationRecord.findFirst({
      where: {
        tenantId: this.config.tenantId,
        kid,
        algorithm: "RS256",
        status: { in: ["active", "verifying", "retired"] }
      }
    });

    if (!record || !this.isVerificationKeyUsable(record)) {
      throw new Error("Unknown JWT kid.");
    }

    return this.readPublicKey(record.metadataJson);
  }

  private async loadUsableKeyRecords() {
    const records = await this.prisma.keyRotationRecord.findMany({
      where: {
        tenantId: this.config.tenantId,
        algorithm: "RS256",
        status: { in: ["active", "verifying", "retired"] }
      },
      orderBy: { createdAt: "desc" }
    });
    return records.filter((record) => this.isVerificationKeyUsable(record));
  }

  private isVerificationKeyUsable(record: { status: string; retiredAt?: Date | null }) {
    if (record.status !== "retired") {
      return true;
    }
    if (!record.retiredAt) {
      return false;
    }
    const maxTokenLifetimeSeconds = Math.max(
      this.config.accessTokenTtlSeconds,
      this.config.targetTokenTtlSeconds,
      300,
    );
    return Date.now() - record.retiredAt.getTime() <= (maxTokenLifetimeSeconds + 60) * 1000;
  }

  private readPrivateKey(metadata: unknown) {
    const encrypted = this.readMetadataString(metadata, "private_key_ciphertext");
    if (!encrypted) {
      throw new Error("Active signing key is missing private_key_ciphertext.");
    }
    return this.secrets.decrypt(encrypted);
  }

  private readPublicKey(metadata: unknown) {
    const value = this.readMetadataString(metadata, "public_key_pem");
    if (!value) {
      throw new Error("Signing key is missing public_key_pem.");
    }
    return value;
  }

  private readMetadataString(metadata: unknown, key: string) {
    if (!metadata || typeof metadata !== "object" || !(key in metadata)) {
      return "";
    }
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
  }
}
