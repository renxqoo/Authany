import { Injectable } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class CsrfService {
  private readonly ttlMilliseconds = 15 * 60 * 1000;

  constructor(private readonly config: AppConfigService) {}

  issue(purpose: string) {
    const timestamp = Date.now().toString(36);
    const nonce = randomBytes(16).toString("base64url");
    const base = [purpose, timestamp, nonce].join(".");
    const signature = this.sign(base);
    return `${base}.${signature}`;
  }

  verify(token: string | undefined, purpose: string) {
    if (!token) {
      return false;
    }
    const [actualPurpose, timestampValue, nonce, signature] = token.split(".");
    if (!actualPurpose || !timestampValue || !nonce || !signature || actualPurpose !== purpose) {
      return false;
    }

    const issuedAt = parseInt(timestampValue, 36);
    if (!Number.isFinite(issuedAt) || issuedAt + this.ttlMilliseconds < Date.now()) {
      return false;
    }

    const base = [actualPurpose, timestampValue, nonce].join(".");
    const expected = this.sign(base);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
  }

  private sign(value: string) {
    return createHmac("sha256", this.config.cookieSecret).update(value).digest("base64url");
  }
}
