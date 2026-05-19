import { Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { LoginSessionService } from "./login-session.service";
import { AppConfigService } from "../config/app-config.service";
import { PrismaService } from "../prisma/prisma.service";
import { ClientIpService } from "./client-ip.service";

@Injectable()
export class CurrentOperatorService {
  constructor(
    private readonly sessions: LoginSessionService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly clientIp: ClientIpService,
  ) {}

  async resolveOperatorId(request: FastifyRequest) {
    const operator = await this.resolveActiveOperator(request);
    return operator?.id ?? null;
  }

  async resolveActiveOperator(request: FastifyRequest) {
    const cookieValue = request.cookies?.[this.config.loginCookieName];
    const session = await this.sessions.parse(cookieValue, {
      ip: this.clientIp.resolve(request),
      userAgent: readUserAgent(request)
    });
    if (!session) {
      return null;
    }
    return this.prisma.operatorAccount.findFirst({
      where: {
        id: session.operatorId,
        tenantId: this.config.tenantId,
        status: "active"
      }
    });
  }
}

function readUserAgent(request: FastifyRequest) {
  const userAgent = request.headers["user-agent"];
  return Array.isArray(userAgent) ? userAgent[0] : userAgent;
}
