import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppConfigService } from "../config/app-config.service";

interface LoginSessionPayload {
  userId: string;
  tenantId: string;
  expiresAt: number;
}

@Injectable()
export class LoginSessionService {
  constructor(private readonly config: AppConfigService) {}

  create(userId: string) {
    const payload: LoginSessionPayload = {
      userId,
      tenantId: this.config.tenantId,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000
    };
    const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.sign(raw);
    return `${raw}.${signature}`;
  }

  parse(cookieValue?: string | null) {
    if (!cookieValue) {
      return null;
    }

    const [raw, signature] = cookieValue.split(".");
    if (!raw || !signature) {
      return null;
    }

    const expected = this.sign(raw);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as LoginSessionPayload;
    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  }

  private sign(value: string) {
    return createHmac("sha256", this.config.cookieSecret).update(value).digest("base64url");
  }
}
