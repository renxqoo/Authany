export interface ApiErrorView {
  title: string;
  message: string;
}

const messages: Record<string, ApiErrorView> = {
  invalid_admin_token: {
    title: "Session expired",
    message: "Please sign in again with an administrator account."
  },
  admin_forbidden: {
    title: "Admin permission required",
    message: "Your account is authenticated but does not have platform_admin access."
  },
  invalid_runtime_refresh_policy: {
    title: "Invalid runtime policy",
    message: "Stateless runtimes cannot enable delegation refresh."
  },
  rate_limited: {
    title: "Too many requests",
    message: "Please wait a moment and retry."
  }
};

export function mapApiError(code?: string): ApiErrorView {
  return messages[code ?? ""] ?? {
    title: "Request failed",
    message: "The request could not be completed. Check the input and try again."
  };
}
