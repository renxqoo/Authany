import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface RequestContext {
  requestId: string;
}

export function getRequestContext(request: FastifyRequest, reply?: FastifyReply): RequestContext {
  const external = request.headers["x-request-id"];
  const requestId = randomUUID();
  if (reply) {
    reply.header("x-request-id", requestId);
    if (external) {
      reply.header("x-external-request-id", Array.isArray(external) ? external[0] : external);
    }
  }
  return { requestId };
}
