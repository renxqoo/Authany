import { HttpException, HttpStatus } from "@nestjs/common";
import type { ApiErrorResponse } from "./api-response";

export function apiError(
  status: HttpStatus,
  code: string,
  message: string,
  data?: Record<string, unknown>,
) {
  const payload: ApiErrorResponse = {
    code,
    message,
    data
  };
  return new HttpException(payload, status);
}
