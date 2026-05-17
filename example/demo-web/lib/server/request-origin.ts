export interface RequestOriginInput {
  headers: Headers;
  url: string;
}

export function resolveRequestOrigin(request: RequestOriginInput) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "http";
  return `${protocol}://${host}`;
}
