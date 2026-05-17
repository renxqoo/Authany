import Fastify from "fastify";
import { TargetAuthError, verifyDelegationToken } from "./auth.js";
import { financeSummary } from "./resource.js";
import type { TargetServiceEnv } from "./env.js";

export function buildApp(env: TargetServiceEnv) {
  const app = Fastify({ logger: false });

  app.get("/healthz", async () => ({
    status: "ok",
    targetResource: env.targetResource,
    audience: env.audience,
    issuer: env.issuer
  }));

  app.get("/api/resources/finance-summary", async (request, reply) => {
    try {
      const claims = await verifyDelegationToken(request.headers.authorization, env);
      return financeSummary(env, claims);
    } catch (error) {
      const authError = normalizeAuthError(error);
      reply.status(authError.status);
      return {
        code: authError.code,
        message: authError.message
      };
    }
  });

  return app;
}

function normalizeAuthError(error: unknown) {
  if (error instanceof TargetAuthError) {
    return error;
  }
  return new TargetAuthError("Delegation token verification failed.", 401, "invalid_token");
}
