export function getDemoEnv() {
  const authanyBaseUrl = process.env.AUTHANY_INTERNAL_URL;
  const clientId = process.env.DEMO_WEB_CLIENT_ID;
  const clientSecret = process.env.DEMO_WEB_CLIENT_SECRET;
  const redirectUri = process.env.DEMO_WEB_REDIRECT_URI;
  const sessionSecret = process.env.DEMO_WEB_SESSION_SECRET;
  const agentId = process.env.DEMO_AGENT_ID;
  const runtimeId = process.env.DEMO_RUNTIME_ID;
  const agentCredential = process.env.DEMO_AGENT_CREDENTIAL;
  const targetResource = process.env.DEMO_TARGET_RESOURCE;
  const targetServiceUrl = process.env.DEMO_TARGET_SERVICE_URL;
  if (!authanyBaseUrl || !clientId || !clientSecret || !redirectUri || !sessionSecret || !agentId || !runtimeId || !agentCredential || !targetResource || !targetServiceUrl) {
    throw new Error("AUTHANY_INTERNAL_URL, DEMO_WEB_CLIENT_ID, DEMO_WEB_CLIENT_SECRET, DEMO_WEB_REDIRECT_URI, DEMO_WEB_SESSION_SECRET, DEMO_AGENT_ID, DEMO_RUNTIME_ID, DEMO_AGENT_CREDENTIAL, DEMO_TARGET_RESOURCE, and DEMO_TARGET_SERVICE_URL are required.");
  }
  return {
    authanyBaseUrl,
    clientId,
    clientSecret,
    redirectUri,
    sessionSecret,
    cookieName: "authany_demo_session",
    agentId,
    runtimeId,
    agentCredential,
    targetResource,
    targetServiceUrl
  };
}
