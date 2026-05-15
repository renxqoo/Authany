import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

@Injectable()
export class HashService {
  hashSecret(value: string) {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(value, salt, 64).toString("hex");
    return `${salt}:${derived}`;
  }

  verifySecret(value: string, encoded: string) {
    const [salt, original] = encoded.split(":");
    if (!salt || !original) {
      return false;
    }
    const candidate = scryptSync(value, salt, 64).toString("hex");
    return timingSafeEqual(Buffer.from(original), Buffer.from(candidate));
  }

  hashOpaqueToken(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
