import { CanActivate, ExecutionContext, HttpException, Injectable, HttpStatus } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { AppConfigService } from "../config/app-config.service";
import { apiError } from "../http/http-errors";
import { TokenSignerService } from "../security/token-signer.service";
import { TokenStatusService } from "../security/token-status.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly config: AppConfigService,
    private readonly tokenSigner: TokenSignerService,
    private readonly prisma: PrismaService,
    private readonly tokenStatus: TokenStatusService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

    if (!token) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_admin_token", "Admin token is invalid.");
    }

    try {
      const verified = await this.tokenSigner.verify(token, this.config.baseUrl);
      const subject = String(verified.payload.sub ?? "");
      const jti = String(verified.payload.jti ?? "");
      if (!await this.tokenStatus.isActiveAccessToken({ jti, tokenType: "access_token" })) {
        throw apiError(HttpStatus.UNAUTHORIZED, "invalid_admin_token", "Admin token is invalid.");
      }
      const operatorId = subject.startsWith("operator:") ? subject.slice("operator:".length) : "";
      const scope = String(verified.payload.scope ?? "");
      const roles = Array.isArray(verified.payload.roles)
        ? verified.payload.roles.map(String)
        : [];
      const hasTokenPrivilege = roles.includes("platform_admin") || scope.split(" ").includes("authany.admin");
      if (!operatorId || !hasTokenPrivilege) {
        throw apiError(HttpStatus.FORBIDDEN, "admin_forbidden", "Admin permission is required.");
      }

	      const role = await this.prisma.operatorRole.findFirst({
	        where: {
	          operatorId,
	          tenantId: this.config.tenantId,
	          status: "active",
          OR: [
            { roleCode: "platform_admin" },
            { scope: { contains: "authany.admin" } }
          ]
        }
      });
      if (!role) {
        throw apiError(HttpStatus.FORBIDDEN, "admin_forbidden", "Admin permission is required.");
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw apiError(HttpStatus.INTERNAL_SERVER_ERROR, "admin_auth_failed", "Admin authentication failed.");
    }
  }
}
