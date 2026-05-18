import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class SecretEncryptionService {
  private readonly algorithm = "aes-256-gcm";

  constructor(private readonly config: AppConfigService) {}

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      "v2",
      this.keyId(),
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url")
    ].join(".");
  }

  decrypt(value: string) {
    const [version, , iv, tag, ciphertext] = value.split(".");
    if (!iv || !tag || !ciphertext || (version !== "v1" && version !== "v2")) {
      throw new Error("Secret ciphertext format is invalid.");
    }
    const decipher = createDecipheriv(this.algorithm, this.key(version), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final()
    ]);
    return plaintext.toString("utf8");
  }

  encryptJson(value: unknown) {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson(value: string) {
    return JSON.parse(this.decrypt(value)) as Record<string, unknown>;
  }

  keyId() {
    return createHash("sha256")
      .update(this.config.appSecretEncryptionKey)
      .digest("base64url")
      .slice(0, 16);
  }

  private key(version: "v1" | "v2" = "v2") {
    if (version === "v1") {
      return createHash("sha256").update(this.config.appSecretEncryptionKey).digest();
    }
    return Buffer.from(hkdfSync(
      "sha256",
      Buffer.from(this.config.appSecretEncryptionKey, "utf8"),
      Buffer.from("authany.secret-encryption", "utf8"),
      Buffer.from(`tenant:${this.config.tenantId}:v2`, "utf8"),
      32,
    ));
  }
}
