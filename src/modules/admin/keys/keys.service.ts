import { HttpStatus, Injectable } from "@nestjs/common";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import { AppConfigService } from "../../../shared/config/app-config.service";
import { optionalString } from "../shared/input-validation";
import { SecretEncryptionService } from "../../../shared/security/secret-encryption.service";
import { apiError } from "../../../shared/http/http-errors";

@Injectable()
export class KeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly secrets: SecretEncryptionService,
  ) {}

  async list() {
    const records = await this.prisma.keyRotationRecord.findMany({
      where: { tenantId: this.config.tenantId },
      orderBy: { createdAt: "desc" }
    });
    return records.map((record) => sanitizeKeyRecord(record));
  }

  async get(id: string) {
    const record = await this.requireRecord(id);
    return sanitizeKeyRecord(record);
  }

  create(input: { kid?: string; algorithm?: string }) {
    const algorithm = optionalString(input.algorithm) ?? "RS256";
    if (algorithm !== "RS256") {
      throw apiError(HttpStatus.BAD_REQUEST, "invalid_key_algorithm", "Only RS256 signing keys are supported.");
    }
    return this.prisma.keyRotationRecord.create({
      data: {
        tenantId: this.config.tenantId,
        kid: optionalString(input.kid) ?? `kid_${randomUUID()}`,
        algorithm,
        status: "pending",
        metadataJson: this.generateRsaKeyPair()
      }
    }).then(sanitizeKeyRecord);
  }

  async activate(id: string) {
    await this.requireRecord(id);
    const now = new Date();
    await this.prisma.keyRotationRecord.updateMany({
      where: {
        tenantId: this.config.tenantId,
        status: "active"
      },
      data: {
        status: "verifying",
        retiredAt: null
      }
    });

    return this.prisma.keyRotationRecord.update({
      where: { id },
      data: {
        status: "active",
        activatedAt: now,
        retiredAt: null
      }
    }).then(sanitizeKeyRecord);
  }

  async retire(id: string) {
    await this.requireRecord(id);
    return this.prisma.keyRotationRecord.update({
      where: { id },
      data: {
        status: "retired",
        retiredAt: new Date()
      }
    }).then(sanitizeKeyRecord);
  }

  private generateRsaKeyPair() {
    const pair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" }
    });

    return {
      private_key_ciphertext: this.secrets.encrypt(pair.privateKey),
      encryption_key_id: this.secrets.keyId(),
      public_key_pem: pair.publicKey
    };
  }

  private async requireRecord(id: string) {
    const record = await this.prisma.keyRotationRecord.findFirst({
      where: {
        id,
        tenantId: this.config.tenantId
      }
    });
    if (!record) {
      throw apiError(HttpStatus.NOT_FOUND, "key_not_found", "Signing key was not found.");
    }
    return record;
  }
}

function sanitizeKeyRecord<T extends { metadataJson?: unknown }>(record: T) {
  const metadata = record.metadataJson && typeof record.metadataJson === "object"
    ? record.metadataJson as Record<string, unknown>
    : {};
  return {
    ...record,
    metadataJson: {
      encryption_key_id: metadata.encryption_key_id,
      has_private_key: Boolean(metadata.private_key_ciphertext),
      public_key_pem: metadata.public_key_pem
    }
  };
}
