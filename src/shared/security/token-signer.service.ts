import { Injectable } from "@nestjs/common";
import { createPrivateKey, createPublicKey, randomUUID } from "node:crypto";
import { exportJWK, importPKCS8, importSPKI, SignJWT, jwtVerify, type JWTPayload } from "jose";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class TokenSignerService {
  private readonly issuer: string;
  private readonly kid = "authany-default-kid";

  constructor(private readonly config: AppConfigService) {
    this.issuer = config.baseUrl;
  }

  async sign(payload: JWTPayload, options: { audience?: string; expiresInSeconds: number }) {
    const privateKey = await importPKCS8(this.config.jwtPrivateKeyPem, "RS256");
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid: this.kid, typ: "JWT" })
      .setIssuer(this.issuer)
      .setIssuedAt(now)
      .setJti(randomUUID())
      .setExpirationTime(now + options.expiresInSeconds)
      .setAudience(options.audience ?? payload.aud)
      .sign(privateKey);
  }

  async verify(token: string, audience?: string) {
    const publicKey = await importSPKI(this.config.jwtPublicKeyPem, "RS256");
    return jwtVerify(token, publicKey, {
      issuer: this.issuer,
      audience
    });
  }

  async getJwks() {
    const publicKey = createPublicKey(this.config.jwtPublicKeyPem);
    const jwk = await exportJWK(publicKey);
    return {
      keys: [{ ...jwk, alg: "RS256", kid: this.kid, use: "sig" }]
    };
  }

  getIssuer() {
    return this.issuer;
  }
}
