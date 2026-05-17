import { previewToken } from "@/lib/token-preview";
import { getDemoEnv } from "./env";
import type { DemoSession } from "./session";

interface TargetTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

type RequesterPrincipal = "application" | "agent";

export async function accessTargetResource(session: DemoSession) {
  const operatorSubject = readOperatorSubjectFromSession(session);
  if (!operatorSubject) {
    return {
      ok: false,
      stage: "session",
      message: "Demo session does not contain an operator subject."
    };
  }

  const targetToken = await requestTargetToken({
    principal: "application",
    externalContext: {
      provider: "demo-web",
      interaction: "hosted_authorization",
      operator_subject: operatorSubject
    }
  });
  if (!targetToken.ok) {
    return targetToken;
  }

  const env = getDemoEnv();
  const target = await fetchTargetResource(env.targetServiceUrl, targetToken.token);
  const body = await target.json().catch(() => ({}));
  return {
    ok: target.ok,
    stage: "target-service",
    targetStatus: target.status,
    delegationToken: previewToken(targetToken.token.access_token),
    data: body
  };
}

export async function accessAgentOnlyResource() {
  const env = getDemoEnv();
  const targetToken = await requestTargetToken({ principal: "agent" });
  if (!targetToken.ok) {
    return targetToken;
  }

  const target = await fetchTargetResource(env.targetServiceUrl, targetToken.token);
  const body = await target.json().catch(() => ({}));
  return {
    ok: target.ok,
    stage: "target-service",
    targetStatus: target.status,
    delegationToken: previewToken(targetToken.token.access_token),
    data: body
  };
}

export async function accessFailureDemo() {
  const env = getDemoEnv();
  const response = await fetch(`${env.authanyBaseUrl}/api/target-token`, {
    method: "POST",
    headers: {
      authorization: "Bearer intentionally-wrong-requester-jwt",
      "content-type": "application/json"
    },
    body: JSON.stringify(buildTargetTokenPayload())
  });
  const body = await response.json().catch(() => ({}));
  return {
    ok: false,
    stage: "delegation",
    targetStatus: response.status,
    data: body
  };
}

export async function accessLarkEbfxResource(senderId: string) {
  const authorization = resolveEbfxAuthorization(senderId);
  if (!authorization.authorized) {
    return {
      ok: false,
      stage: "ebfx-authorization",
      code: "target_authorization_required",
      senderId,
      message: "EBFX has not authorized this Lark sender for resource access yet.",
      loginUrl: buildEbfxAuthorizationUrl(senderId)
    };
  }

  const targetToken = await requestTargetToken({
    principal: "agent",
    externalContext: {
      provider: "lark",
      lark: {
        sender_id: senderId,
        message_id: "om_demo_message",
        tenant_key: "demo_lark_tenant"
      },
      ebfx_authorization: {
        business_user_id: authorization.businessUserId,
        scopes: authorization.scopes
      }
    }
  });
  if (!targetToken.ok) {
    return targetToken;
  }

  const env = getDemoEnv();
  const target = await fetchTargetResource(env.targetServiceUrl, targetToken.token);
  const body = await target.json().catch(() => ({}));
  return {
    ok: target.ok,
    stage: "target-service",
    targetStatus: target.status,
    senderId,
    ebfxUserId: authorization.businessUserId,
    delegationToken: previewToken(targetToken.token.access_token),
    data: body
  };
}

export function readOperatorSubjectFromSession(session: DemoSession) {
  const subject = typeof session.userInfo?.sub === "string" ? session.userInfo.sub : "";
  return subject.startsWith("operator:") ? subject : "";
}

export function buildTargetTokenPayload(externalContext?: Record<string, unknown>) {
  void externalContext;
  return {
    grant_type: "urn:authany:params:oauth:grant-type:target-access",
    target_resource: getDemoEnv().targetResource
  };
}

export function buildAgentOnlyTargetTokenPayload() {
  return buildTargetTokenPayload();
}

async function requestTargetToken(input: { principal: RequesterPrincipal; externalContext?: Record<string, unknown> }) {
  const env = getDemoEnv();
  const requester = await requestRequesterToken(input.principal, input.externalContext);
  if (!requester.ok) {
    return requester;
  }
  const response = await fetch(`${env.authanyBaseUrl}/api/target-token`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${requester.requesterToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(buildTargetTokenPayload())
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false as const,
      stage: "delegation",
      targetStatus: response.status,
      data: body
    };
  }
  return {
    ok: true as const,
    token: body as TargetTokenResponse
  };
}

export async function requestRequesterToken(
  principal: RequesterPrincipal,
  externalContext?: Record<string, unknown>,
) {
  const env = getDemoEnv();
  const requester = buildRequesterTokenPayload(principal, externalContext);
  const response = await fetch(`${env.authanyBaseUrl}/api/requester-token`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${principal === "application" ? env.clientSecret : env.agentCredential}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(requester)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false as const,
      stage: "requester-token",
      targetStatus: response.status,
      data: body
    };
  }
  return {
    ok: true as const,
    requesterToken: (body as { requester_token: string }).requester_token
  };
}

export function buildRequesterTokenPayload(
  principal: RequesterPrincipal,
  externalContext?: Record<string, unknown>,
) {
  const env = getDemoEnv();
  const common = {
    grant_type: "urn:authany:params:oauth:grant-type:requester-token",
    target_resource: env.targetResource,
    external_context: externalContext
  };
  if (principal === "application") {
    return {
      ...common,
      principal_type: "application",
      app_id: env.clientId
    };
  }
  return {
    ...common,
    principal_type: "agent",
    agent_id: env.agentId,
    runtime_id: env.runtimeId
  };
}

async function fetchTargetResource(targetServiceUrl: string, token: TargetTokenResponse) {
  try {
    return await fetch(`${targetServiceUrl}/api/resources/finance-summary`, {
      headers: {
        authorization: `${token.token_type} ${token.access_token}`
      }
    });
  } catch {
    return Response.json({
      code: "target_service_unreachable",
      message: `Target service is not reachable at ${targetServiceUrl}. Start it with pnpm target:dev.`
    }, { status: 503 });
  }
}

function resolveEbfxAuthorization(senderId: string) {
  const normalized = senderId.trim();
  if (normalized === "ou_8d3de97c48f36f53b1f703dd59897f9f") {
    return {
      authorized: true as const,
      businessUserId: "ebfx_user_finance_001",
      scopes: ["dashboard.pending.read", "dashboard.profit.read"]
    };
  }
  return { authorized: false as const };
}

function buildEbfxAuthorizationUrl(senderId: string) {
  const url = new URL("https://ebfx.example.test/lark/authorize");
  url.searchParams.set("sender_id", senderId);
  url.searchParams.set("source", "authany-demo-web");
  url.searchParams.set("scope", "dashboard.pending.read dashboard.profit.read");
  return url.toString();
}
