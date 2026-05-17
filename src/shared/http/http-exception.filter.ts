import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getRequestContext } from "./request-context";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const { requestId } = getRequestContext(request, response);
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      response.status(status).send(payload);
      return;
    }

    console.error({
      requestId,
      method: request.method,
      path: request.url,
      error: exception instanceof Error ? {
        name: exception.name,
        message: exception.message,
        stack: exception.stack
      } : String(exception)
    });
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      code: "internal_error",
      message: "Internal server error"
    });
  }
}
