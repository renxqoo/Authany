export function getAdminEnv() {
  const authanyBaseUrl = process.env.AUTHANY_INTERNAL_URL;
  const adminClientId = process.env.AUTHANY_ADMIN_CLIENT_ID;
  const adminClientSecret = process.env.AUTHANY_ADMIN_CLIENT_SECRET;
  const publicBaseUrl = process.env.ADMIN_WEB_PUBLIC_URL;
  const sessionSecret = process.env.ADMIN_WEB_SESSION_SECRET;
  if (!authanyBaseUrl || !adminClientId || !adminClientSecret || !publicBaseUrl || !sessionSecret) {
    throw new Error("AUTHANY_INTERNAL_URL, AUTHANY_ADMIN_CLIENT_ID, AUTHANY_ADMIN_CLIENT_SECRET, ADMIN_WEB_PUBLIC_URL, and ADMIN_WEB_SESSION_SECRET are required.");
  }
  return {
    authanyBaseUrl,
    adminClientId,
    adminClientSecret,
    publicBaseUrl,
    sessionSecret,
    cookieName: "authany_admin_session"
  };
}
