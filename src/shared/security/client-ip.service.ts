import { Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { isIP } from "node:net";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class ClientIpService {
  constructor(private readonly config: AppConfigService) {}

  resolve(request: FastifyRequest) {
    const remoteAddress = normalizeIp(request.socket.remoteAddress);
    if (!remoteAddress) {
      return "unknown";
    }

    const trustedProxies = new Set(this.config.trustedProxies.map(normalizeIp).filter(Boolean) as string[]);
    if (!trustedProxies.has(remoteAddress)) {
      return remoteAddress;
    }

    const forwarded = String(request.headers["x-forwarded-for"] ?? "");
    const chain = forwarded
      .split(",")
      .map((item) => normalizeIp(item))
      .filter((item): item is string => Boolean(item));
    if (chain.length === 0) {
      return remoteAddress;
    }

    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const candidate = chain[index];
      if (!trustedProxies.has(candidate)) {
        return candidate;
      }
    }

    return chain[0];
  }
}

function normalizeIp(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.startsWith("::ffff:") ? trimmed.slice("::ffff:".length) : trimmed;
  return isIP(normalized) ? normalized : "";
}
