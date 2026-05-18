import type { FastifyReply } from "fastify";

export function sendRedirect(reply: FastifyReply, url: string, statusCode = 302) {
  return reply.status(statusCode).header("location", url).send();
}
