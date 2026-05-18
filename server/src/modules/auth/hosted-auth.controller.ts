import { Body, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { AppConfigService } from "../../shared/config/app-config.service";
import { CurrentOperatorService } from "../../shared/security/current-user.service";
import { normalizeReturnTo, renderHostedLoginPage } from "./hosted-login";
import { sendRedirect } from "../../shared/http/redirect";
import { getRequestContext } from "../../shared/http/request-context";
import { ClientIpService } from "../../shared/security/client-ip.service";
import { CsrfService } from "../../shared/security/csrf.service";
import { HttpException } from "@nestjs/common";

@Controller()
export class HostedAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
    private readonly currentOperator: CurrentOperatorService,
    private readonly clientIp: ClientIpService,
    private readonly csrf: CsrfService,
  ) {}

  @Get("/login")
  async loginPage(
    @Query("return_to") returnTo: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const next = normalizeReturnTo(returnTo);
    if (await this.currentOperator.resolveOperatorId(request)) {
      return sendRedirect(reply, next);
    }
    return reply.type("text/html").send(renderHostedLoginPage({
      returnTo: next,
      csrfToken: this.csrf.issue("hosted_login")
    }));
  }

  @Post("/login")
  async login(
    @Body() body: { username?: string; password?: string; return_to?: string; csrf_token?: string },
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const returnTo = normalizeReturnTo(body.return_to);
    if (!this.csrf.verify(body.csrf_token, "hosted_login")) {
      return reply
        .status(403)
        .type("text/html")
        .send(renderHostedLoginPage({
          returnTo,
          csrfToken: this.csrf.issue("hosted_login"),
          error: "Your session expired. Refresh the page and try again."
        }));
    }
    const context = getRequestContext(request, reply);
    try {
      const result = await this.authService.login(body.username ?? "", body.password ?? "", {
        ip: this.clientIp.resolve(request),
        requestId: context.requestId
      });
      reply.setCookie(this.config.loginCookieName, result.sessionCookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: this.config.secureCookies,
        path: "/",
        signed: false
      });
      return sendRedirect(reply, returnTo, 303);
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus();
        if (status !== 401) {
          throw error;
        }
      } else {
        throw error;
      }
      return reply
        .status(401)
        .type("text/html")
        .send(renderHostedLoginPage({
          returnTo,
          csrfToken: this.csrf.issue("hosted_login"),
          error: "Username or password is invalid."
        }));
    }
  }
}
