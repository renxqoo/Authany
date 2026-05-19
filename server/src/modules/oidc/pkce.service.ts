import { Injectable } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";

@Injectable()
export class PkceService {
  verify(codeVerifier: string, codeChallenge: string, method: string) {
    if (method !== "S256") {
      return false;
    }
    if (!isValidCodeVerifier(codeVerifier)) {
      return false;
    }
    const derived = createHash("sha256").update(codeVerifier).digest("base64url");
    const derivedBuffer = Buffer.from(derived);
    const expectedBuffer = Buffer.from(codeChallenge);
    return derivedBuffer.length === expectedBuffer.length && timingSafeEqual(derivedBuffer, expectedBuffer);
  }
}

function isValidCodeVerifier(value: string) {
  return value.length >= 43
    && value.length <= 128
    && /^[A-Za-z0-9\-._~]+$/u.test(value);
}
