export function previewToken(token?: string) {
  if (!token) {
    return "";
  }
  if (token.length <= 24) {
    return token;
  }
  return `${token.slice(0, 12)}...${token.slice(-8)}`;
}
