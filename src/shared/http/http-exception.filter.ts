import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { FastifyReply } from "fastify";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      response.status(status).send(payload);
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      code: "internal_error",
      message: "Internal server error"
    });
  }
}
