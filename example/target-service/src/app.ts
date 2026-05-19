import Fastify from "fastify";
import type { FastifyRequest, FastifyReply } from "fastify";
import { TargetTokenVerifier, TokenVerificationError } from "@authany/sdk";
import type { TargetAccessClaims } from "@authany/sdk";
import { financeSummary } from "./resource.js";
import {
  queryStockList,
  queryStockDaily,
  queryMarketOverview,
  queryIndexDaily,
  queryDailyStockPool,
  queryLimitUpStats,
  queryDragonTiger,
  queryFundFlow,
  queryConceptList,
  queryConceptDaily,
} from "./resource/db-queries.js";
import type { TargetServiceEnv } from "./env.js";
import {
  type AnyAccessClaims,
  extractToken,
  isLocalToken,
  verifyLocalAccessToken,
  signLocalAccessToken,
  verifyPassword,
} from "./auth.js";
import { findUserByUsername } from "./user-queries.js";
import { renderLoginPage, renderIndexPage } from "./login-page.js";

declare module "fastify" {
  interface FastifyRequest {
    claims: AnyAccessClaims;
  }
}

function setCookieHeader(reply: FastifyReply, name: string, value: string, maxAge: number) {
  const encoded = encodeURIComponent(value);
  reply.header("Set-Cookie", `${name}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}

function clearCookieHeader(reply: FastifyReply, name: string) {
  reply.header("Set-Cookie", `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function buildApp(env: TargetServiceEnv) {
  const app = Fastify({ logger: false });
  const verifier = new TargetTokenVerifier({
    issuer: env.issuer,
    audience: env.audience,
    targetResource: env.targetResource,
  });

  // ── Form body parser (zero-dependency) ───────────────────────────────
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (req: FastifyRequest, body: string, done: (err: Error | null, value?: unknown) => void) => {
      void req;
      const params: Record<string, string> = {};
      for (const pair of body.split("&")) {
        const eqIndex = pair.indexOf("=");
        if (eqIndex <= 0) continue;
        const key = decodeURIComponent(pair.slice(0, eqIndex).replace(/\+/g, " "));
        const value = decodeURIComponent(pair.slice(eqIndex + 1).replace(/\+/g, " "));
        params[key] = value;
      }
      done(null, params);
    },
  );

  // ── Dual-mode preHandler ──────────────────────────────────────────────
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url;

    // Skip auth for login/logout pages
    if (url === "/login" || url === "/logout") return;

    // For non-API routes, try cookie auth but don't block
    if (!url.startsWith("/api/")) {
      const token = extractToken(request);
      if (token) {
        try {
          request.claims = await resolveClaims(token, env);
        } catch {
          // Ignore — page handlers will check for missing claims
        }
      }
      return;
    }

    // /api/* routes — authentication required
    const token = extractToken(request);
    if (!token) {
      reply.status(401);
      throw new TokenVerificationError("Bearer target access token is required.", "missing_token");
    }

    try {
      request.claims = await resolveClaims(token, env);
    } catch (error) {
      if (error instanceof TokenVerificationError) {
        reply.status(401);
      }
      throw error;
    }
  });

  async function resolveClaims(token: string, env: TargetServiceEnv): Promise<AnyAccessClaims> {
    if (isLocalToken(token)) {
      return verifyLocalAccessToken(token, env.jwtSecret);
    }
    return verifier.verify(token) as Promise<TargetAccessClaims>;
  }

  // ── Error handler ────────────────────────────────────────────────────
  app.setErrorHandler((error: Error, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof TokenVerificationError) {
      reply.status(reply.statusCode === 200 ? 401 : reply.statusCode);
      return { code: error.code, message: error.message };
    }
    // Handle jose errors
    if (error instanceof Error) {
      const joseErrorNames = [
        "JWTExpired",
        "JWSSignatureVerificationFailed",
        "JWSInvalid",
        "JWTInvalid",
        "JWKInvalid",
        "JWKSNoMatchingKey",
      ];
      if (joseErrorNames.includes(error.name)) {
        reply.status(401);
        return { code: "token_invalid", message: error.message };
      }
    }
    reply.status(500);
    return { code: "internal_error", message: error.message };
  });

  // ── Health check ──────────────────────────────────────────────────────
  app.get("/healthz", async () => ({
    status: "ok",
    targetResource: env.targetResource,
    audience: env.audience,
    issuer: env.issuer,
  }));

  // ── Browser routes ───────────────────────────────────────────────────

  app.get("/", async (request, reply) => {
    if (!request.claims) {
      reply.redirect("/login");
      return;
    }
    const token = extractToken(request) ?? "";
    reply.type("text/html; charset=utf-8");
    return renderIndexPage(request.claims, token);
  });

  app.get("/login", async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return renderLoginPage();
  });

  app.post("/login", async (request, reply) => {
    const body = request.body as Record<string, string>;
    const username = body?.username ?? "";
    const password = body?.password ?? "";

    if (!username || !password) {
      reply.type("text/html; charset=utf-8");
      return renderLoginPage("Username and password are required.");
    }

    const user = await findUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      reply.type("text/html; charset=utf-8");
      return renderLoginPage("Invalid username or password.");
    }

    const token = await signLocalAccessToken(
      { userId: user.id, username: user.username, displayName: user.display_name },
      env.jwtSecret,
    );

    setCookieHeader(reply, "token", token, 8 * 60 * 60);
    reply.redirect("/");
  });

  app.post("/logout", async (_request, reply) => {
    clearCookieHeader(reply, "token");
    reply.redirect("/login");
  });

  // ── API routes ───────────────────────────────────────────────────────

  app.post("/api/auth/login", async (request, reply) => {
    const body = request.body as Record<string, string> | undefined;
    const username = body?.username ?? "";
    const password = body?.password ?? "";

    if (!username || !password) {
      reply.status(400);
      return { code: "bad_request", message: "username and password are required." };
    }

    const user = await findUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      reply.status(401);
      return { code: "invalid_credentials", message: "Invalid username or password." };
    }

    const token = await signLocalAccessToken(
      { userId: user.id, username: user.username, displayName: user.display_name },
      env.jwtSecret,
    );

    return { token_type: "Bearer", access_token: token, expires_in: 8 * 60 * 60 };
  });

  // ── Authenticated resource routes ────────────────────────────────────

  app.get("/api/resources/finance-summary", async (request) => {
    return financeSummary(env, request.claims);
  });

  app.get("/api/resources/stock-list", async (request) => {
    const query = request.query as { page?: string; pageSize?: string; keyword?: string };
    return await queryStockList({
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      keyword: query.keyword,
    });
  });

  app.get("/api/resources/stock-daily/:code", async (request) => {
    const params = request.params as { code: string };
    const query = request.query as { limit?: string };
    return await queryStockDaily(params.code, query.limit ? Number(query.limit) : undefined);
  });

  app.get("/api/resources/market-overview", async () => {
    return await queryMarketOverview();
  });

  app.get("/api/resources/index-daily", async (request) => {
    const query = request.query as { limit?: string };
    return await queryIndexDaily(query.limit ? Number(query.limit) : undefined);
  });

  app.get("/api/resources/daily-stock-pool", async (request) => {
    const query = request.query as { trade_date?: string; limit?: string };
    return await queryDailyStockPool(query.trade_date, query.limit ? Number(query.limit) : undefined);
  });

  app.get("/api/resources/limit-up-stats", async (request) => {
    const query = request.query as { limit?: string };
    return await queryLimitUpStats(query.limit ? Number(query.limit) : undefined);
  });

  app.get("/api/resources/dragon-tiger", async (request) => {
    const query = request.query as { limit?: string };
    return await queryDragonTiger(query.limit ? Number(query.limit) : undefined);
  });

  app.get("/api/resources/fund-flow/:code", async (request) => {
    const params = request.params as { code: string };
    const query = request.query as { limit?: string };
    return await queryFundFlow(params.code, query.limit ? Number(query.limit) : undefined);
  });

  app.get("/api/resources/concept-list", async (request) => {
    const query = request.query as { page?: string; pageSize?: string };
    return await queryConceptList({
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  });

  app.get("/api/resources/concept-daily/:code", async (request) => {
    const params = request.params as { code: string };
    const query = request.query as { limit?: string };
    return await queryConceptDaily(params.code, query.limit ? Number(query.limit) : undefined);
  });

  return app;
}
