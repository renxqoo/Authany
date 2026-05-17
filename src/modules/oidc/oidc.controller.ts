import { Body, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { OidcService } from "./oidc.service";
import { AuthorizeQueryDto } from "./dto/authorize-query.dto";
import { TokenDto } from "./dto/token.dto";
import { IntrospectDto } from "./dto/introspect.dto";
import { RevokeDto } from "./dto/revoke.dto";
import { CurrentOperatorService } from "../../shared/security/current-user.service";
import { sendRedirect } from "../../shared/http/redirect";
import { renderConsentPage } from "./consent-page";
import { ClientIpService } from "../../shared/security/client-ip.service";
import { CsrfService } from "../../shared/security/csrf.service";
import { apiError } from "../../shared/http/http-errors";
import { HttpStatus } from "@nestjs/common";

interface ConsentBody {
  decision?: string;
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  nonce?: string;
  csrf_token?: string;
}

@Controller()
export class OidcController {
  constructor(
    private readonly oidc: OidcService,
    private readonly currentOperator: CurrentOperatorService,
    private readonly clientIp: ClientIpService,
    private readonly csrf: CsrfService,
  ) {}

  @Get("/.well-known/openid-configuration")
  async discovery(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.header("cache-control", "public, max-age=300, must-revalidate");
    return this.oidc.getDiscoveryDocument();
  }

  @Get("/.well-known/jwks.json")
  async jwks(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.header("cache-control", "public, max-age=300, must-revalidate");
    return this.oidc.getJwks();
  }

  @Get("/oauth/authorize")
  async authorize(
    @Query() query: AuthorizeQueryDto,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!await this.currentOperator.resolveOperatorId(request)) {
      const login = new URL("/login", `${request.protocol}://${request.hostname}`);
      login.searchParams.set("return_to", request.url);
      return sendRedirect(reply, login.pathname + login.search);
    }

    if (query.prompt === "consent") {
      const details = await this.oidc.getConsentDetails({
        responseType: query.response_type,
        clientId: query.client_id,
        redirectUri: query.redirect_uri,
        scope: query.scope,
        state: query.state,
        codeChallenge: query.code_challenge,
        codeChallengeMethod: query.code_challenge_method,
        nonce: query.nonce
      });
      return reply.type("text/html").send(renderConsentPage({
        ...details,
        csrfToken: this.csrf.issue("oauth_consent"),
        values: {
          response_type: query.response_type,
          client_id: query.client_id,
          redirect_uri: query.redirect_uri,
          scope: query.scope,
          state: query.state,
          code_challenge: query.code_challenge,
          code_challenge_method: query.code_challenge_method,
          nonce: query.nonce
        }
      }));
    }

    const redirect = await this.oidc.createAuthorizationCode(
      {
        responseType: query.response_type,
        clientId: query.client_id,
        redirectUri: query.redirect_uri,
        scope: query.scope,
        state: query.state,
        codeChallenge: query.code_challenge,
        codeChallengeMethod: query.code_challenge_method,
        nonce: query.nonce
      },
      request,
    );

    return sendRedirect(reply, redirect);
  }

  @Post("/oauth/consent")
  async consent(
    @Body() body: ConsentBody,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const input = {
      responseType: body.response_type ?? "",
      clientId: body.client_id ?? "",
      redirectUri: body.redirect_uri ?? "",
      scope: body.scope ?? "",
      state: body.state ?? "",
      codeChallenge: body.code_challenge ?? "",
      codeChallengeMethod: body.code_challenge_method ?? "",
      nonce: body.nonce
    };
    if (!this.csrf.verify(body.csrf_token, "oauth_consent")) {
      return reply.status(403).type("text/plain").send("Forbidden");
    }

    if (body.decision !== "allow") {
      const redirect = await this.oidc.createAccessDeniedRedirect(input);
      return sendRedirect(reply, redirect, 303);
    }

    const redirect = await this.oidc.createAuthorizationCode(input, request);
    return sendRedirect(reply, redirect, 303);
  }

  @Post("/oauth/token")
  async token(@Body() body: TokenDto, @Req() request: FastifyRequest) {
    if (body.grant_type === "authorization_code") {
      return this.oidc.exchangeAuthorizationCode({
        clientId: body.client_id ?? "",
        clientSecret: body.client_secret,
        code: body.code ?? "",
        redirectUri: body.redirect_uri ?? "",
        codeVerifier: body.code_verifier ?? "",
        ip: this.clientIp.resolve(request)
      });
    }

    if (body.grant_type === "refresh_token") {
      return this.oidc.exchangeRefreshToken({
        clientId: body.client_id ?? "",
        clientSecret: body.client_secret,
        refreshToken: body.refresh_token ?? "",
        ip: this.clientIp.resolve(request)
      });
    }

    if (body.grant_type === "client_credentials") {
      return this.oidc.exchangeClientCredentials({
        clientId: body.client_id ?? "",
        clientSecret: body.client_secret,
        scope: body.scope,
        ip: this.clientIp.resolve(request)
      });
    }

    throw apiError(HttpStatus.BAD_REQUEST, "unsupported_grant_type", "Grant type is not supported.");
  }

  @Post("/oauth/revoke")
  async revoke(@Body() body: RevokeDto) {
    return this.oidc.revokeToken({
      token: body.token,
      tokenTypeHint: body.token_type_hint,
      clientId: body.client_id ?? "",
      clientSecret: body.client_secret
    });
  }

  @Post("/oauth/introspect")
  async introspect(@Body() body: IntrospectDto) {
    return this.oidc.introspectToken({
      token: body.token,
      tokenTypeHint: body.token_type_hint,
      clientId: body.client_id ?? "",
      clientSecret: body.client_secret
    });
  }

  @Get("/oauth/userinfo")
  async userInfo(@Req() request: FastifyRequest) {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    return this.oidc.getUserInfo(token);
  }
}
