import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashSecret(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(value, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function resetClientSecret(input: {
  tenantId: string;
  clientDbId: string;
  secret: string;
  hint: string;
}) {
  await prisma.oAuthClientSecret.updateMany({
    where: {
      clientId: input.clientDbId,
      status: "active"
    },
    data: {
      status: "revoked",
      revokedAt: new Date()
    }
  });

  await prisma.oAuthClientSecret.create({
    data: {
      tenantId: input.tenantId,
      clientId: input.clientDbId,
      secretHash: hashSecret(input.secret),
      hint: input.hint,
      status: "active"
    }
  });
}

async function main() {
  const tenantId = requiredSeedValue("TENANT_ID");
  const authanyBaseUrl = requiredSeedValue("AUTHANY_BASE_URL");
  const clientSecret = requiredSeedValue("SEED_CLIENT_SECRET");
  const adminClientSecret = requiredSeedValue("SEED_ADMIN_CLIENT_SECRET");
  const callerSecret = requiredSeedValue("SEED_CALLER_CREDENTIAL");

  const client = await prisma.oAuthClient.upsert({
    where: { tenantId_clientId: { tenantId, clientId: "demo-web" } },
    create: {
      tenantId,
      clientId: "demo-web",
      clientType: "confidential",
      name: "Demo Web",
      status: "active",
      allowedGrantTypes: ["authorization_code", "refresh_token"],
      allowedScopes: ["openid", "profile", "offline_access"]
    },
    update: {
      status: "active",
      deletedAt: null
    }
  });

  for (const redirectUri of ["http://127.0.0.1:5173/callback", "http://localhost:5173/callback"]) {
    await prisma.oAuthRedirectUri.upsert({
      where: { clientId_redirectUri: { clientId: client.id, redirectUri } },
      create: {
        tenantId,
        clientId: client.id,
        redirectUri
      },
      update: {}
    });
  }

  await resetClientSecret({
    tenantId,
    clientDbId: client.id,
    secret: clientSecret,
    hint: "client..."
  });

  const adminClient = await prisma.oAuthClient.upsert({
    where: { tenantId_clientId: { tenantId, clientId: "authany-admin-web" } },
    create: {
      tenantId,
      clientId: "authany-admin-web",
      clientType: "confidential",
      name: "AuthAny Admin Web",
      status: "active",
      allowedGrantTypes: ["authorization_code", "refresh_token"],
      allowedScopes: ["openid", "profile", "offline_access", "authany.admin"]
    },
    update: {
      status: "active",
      deletedAt: null
    }
  });

  await prisma.oAuthRedirectUri.upsert({
    where: {
      clientId_redirectUri: {
        clientId: adminClient.id,
        redirectUri: "http://127.0.0.1:3005/api/auth/callback"
      }
    },
    create: {
      tenantId,
      clientId: adminClient.id,
      redirectUri: "http://127.0.0.1:3005/api/auth/callback"
    },
    update: {}
  });

  await resetClientSecret({
    tenantId,
    clientDbId: adminClient.id,
    secret: adminClientSecret,
    hint: "admin..."
  });

  const agent = await prisma.agentProfile.upsert({
    where: { tenantId_agentId: { tenantId, agentId: "agent_demo" } },
    create: {
      tenantId,
      agentId: "agent_demo",
      name: "Demo Agent",
      status: "active"
    },
    update: {
      name: "Demo Agent",
      status: "active",
      deletedAt: null
    }
  });

  const existingRuntime = await prisma.runtimeRegistration.findFirst({
    where: {
      tenantId,
      agentId: agent.id,
      runtimeType: "cli",
      runtimeMode: "stateless"
    }
  });

  const runtime = existingRuntime ?? await prisma.runtimeRegistration.create({
    data: {
      tenantId,
      runtimeId: `rt_live_${randomBytes(18).toString("base64url")}`,
      agentId: agent.id,
      runtimeType: "cli",
      runtimeMode: "stateless",
      status: "active"
    }
  });

  await prisma.callerCredential.create({
    data: {
      tenantId,
      agentId: agent.id,
      runtimeRegistrationId: runtime.id,
      credentialType: "agent_secret",
      credentialHint: "agent...",
      secretHashOrPublicKeyRef: hashSecret(callerSecret),
      status: "active"
    }
  });

  const target = await prisma.targetResourceRegistration.upsert({
    where: { tenantId_targetResourceCode: { tenantId, targetResourceCode: "demo-target" } },
    create: {
      tenantId,
      targetResourceCode: "demo-target",
      displayName: "Demo Target",
      audience: "demo-target",
      status: "active",
      tokenValidationMode: "jwks",
      trustConfigJson: { issuer: authanyBaseUrl, validation: "jwks" }
    },
    update: {
      displayName: "Demo Target",
      audience: "demo-target",
      status: "active",
      tokenValidationMode: "jwks",
      trustConfigJson: { issuer: authanyBaseUrl, validation: "jwks" }
    }
  });

  const applicationConnection = await prisma.targetConnection.upsert({
    where: { tenantId_connectionId: { tenantId, connectionId: "tc_demo_application_target" } },
    create: {
      tenantId,
      connectionId: "tc_demo_application_target",
      principalType: "application",
      principalId: "demo-web",
      targetResourceId: target.id,
      targetResource: target.targetResourceCode,
      externalContextMode: "required",
      allowedContextProvidersJson: ["demo-web", "lark"],
      maxTokenTtlSeconds: 900,
      status: "active"
    },
    update: {
      targetResourceId: target.id,
      targetResource: target.targetResourceCode,
      externalContextMode: "required",
      allowedContextProvidersJson: ["demo-web", "lark"],
      maxTokenTtlSeconds: 900,
      status: "active",
      expiresAt: null
    }
  });

  await prisma.accessGrant.upsert({
    where: { tenantId_grantId: { tenantId, grantId: "ag_demo_application_target" } },
    create: {
      tenantId,
      grantId: "ag_demo_application_target",
      connectionId: applicationConnection.id,
      grantType: "target_access",
      effect: "allow",
      constraintsJson: {},
      status: "active",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    update: {
      connectionId: applicationConnection.id,
      effect: "allow",
      status: "active",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  const agentConnection = await prisma.targetConnection.upsert({
    where: { tenantId_connectionId: { tenantId, connectionId: "tc_demo_agent_target" } },
    create: {
      tenantId,
      connectionId: "tc_demo_agent_target",
      principalType: "agent",
      principalId: "agent_demo",
      runtimeRegistrationId: runtime.id,
      targetResourceId: target.id,
      targetResource: target.targetResourceCode,
      externalContextMode: "required",
      allowedContextProvidersJson: ["demo-web"],
      maxTokenTtlSeconds: 900,
      status: "active"
    },
    update: {
      runtimeRegistrationId: runtime.id,
      targetResourceId: target.id,
      targetResource: target.targetResourceCode,
      externalContextMode: "required",
      allowedContextProvidersJson: ["demo-web", "lark"],
      maxTokenTtlSeconds: 900,
      status: "active",
      expiresAt: null
    }
  });

  await prisma.accessGrant.upsert({
    where: { tenantId_grantId: { tenantId, grantId: "ag_demo_agent_target" } },
    create: {
      tenantId,
      grantId: "ag_demo_agent_target",
      connectionId: agentConnection.id,
      grantType: "target_access",
      effect: "allow",
      constraintsJson: {},
      status: "active",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    update: {
      connectionId: agentConnection.id,
      effect: "allow",
      status: "active",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  console.log(JSON.stringify({
    oauthClient: { client_id: "demo-web", client_secret: "[REDACTED]" },
    adminClient: { client_id: "authany-admin-web", client_secret: "[REDACTED]" },
    agent: { agent_id: "agent_demo", runtime_id: runtime.runtimeId, caller_credential: "[REDACTED]" },
    targetResource: { target_resource: "demo-target" },
    targetConnections: ["tc_demo_application_target", "tc_demo_agent_target"],
    accessGrants: ["ag_demo_application_target", "ag_demo_agent_target"],
    generatedSecrets: {
      oauthClient: Boolean(clientSecret),
      adminClient: Boolean(adminClientSecret),
      agentCallerCredential: Boolean(callerSecret)
    }
  }, null, 2));
}

function requiredSeedValue(name: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }
  throw new Error(`${name} must be set before running the seed script.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
