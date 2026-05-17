export function getLoginNoticeKey(reason?: string) {
  if (reason === "session-expired") {
    return "login.sessionExpired";
  }
  if (reason === "session-required") {
    return "login.sessionRequired";
  }
  return "";
}

export function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/dashboard";
  }
  return value;
}

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
