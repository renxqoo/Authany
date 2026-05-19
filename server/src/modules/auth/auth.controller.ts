import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { AppConfigService } from "../../shared/config/app-config.service";
import { getRequestContext } from "../../shared/http/request-context";
import { ok } from "../../shared/http/api-response";
import { ClientIpService } from "../../shared/security/client-ip.service";

@Controller("/api/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
    private readonly clientIp: ClientIpService,
  ) {}

  @Post("/login")
  async login(
    @Body() body: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const context = getRequestContext(request, reply);
    const result = await this.authService.login(body.username, body.password, {
      ip: this.clientIp.resolve(request),
      requestId: context.requestId,
      userAgent: readUserAgent(request)
    });

    reply.setCookie(this.config.loginCookieName, result.sessionCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.secureCookies,
      path: "/",
      signed: false
    });

    return ok(
      {
        operator: {
          username: result.operator.username,
          displayName: result.operator.displayName
        }
      },
      context.requestId,
    );
  }
}

function readUserAgent(request: FastifyRequest) {
  const userAgent = request.headers["user-agent"];
  return Array.isArray(userAgent) ? userAgent[0] : userAgent;
}
