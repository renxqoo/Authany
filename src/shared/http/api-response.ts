export interface ApiSuccessResponse<T> {
  code: "ok";
  message: "success";
  data: T;
  request_id?: string;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  data?: Record<string, unknown>;
  request_id?: string;
}

export function ok<T>(data: T, requestId?: string): ApiSuccessResponse<T> {
  return {
    code: "ok",
    message: "success",
    data,
    request_id: requestId
  };
}
