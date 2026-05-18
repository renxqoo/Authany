import { describe, expect, it, vi } from "vitest";
import { CallerCredentialService } from "../src/modules/delegation/caller-credential.service";
import { DelegationService } from "../src/modules/delegation/delegation.service";
import { DelegationPolicyService } from "../src/modules/delegation/delegation-policy.service";
import { ReplayProtectionService } from "../src/modules/delegation/replay-protection.service";
import { RequesterTokenService } from "../src/modules/delegation/requester-token.service";
import { TargetTokenBrokerService } from "../src/modules/delegation/delegation-token-broker.service";
import { TargetTokenExchangeService } from "../src/modules/delegation/target-token-exchange.service";
import { createMockConfig, createMockPrisma, createMockRequest, createMockTokenSigner, getErrorCode, mockRequesterJwt } from "./test-helpers";
import { HashService } from "../src/shared/security/hash.service";
import { createMockSecretEncryption } from "./security-test-helpers";

describe("target token exchange", () => {
  it("issues a requester JWT from an agent caller credential", async () => {
    const { audit, prisma, service } = createService();
    const hashes = new HashService();
    prisma.agentProfile.findFirst.mockResolvedValue({ id: "agent_db_1", agentId: "agent_demo", status: "active" });
    prisma.runtimeRegistration.findFirst.mockResolvedValue({ id: "runtime_db_1", runtimeId: "runtime_demo_cli", agentId: "agent_db_1", status: "active" });
    prisma.callerCredential.findMany.mockResolvedValue([{
      id: "credential_1",
      secretHashOrPublicKeyRef: hashes.hashSecret("agent-secret"),
      status: "active",
      expiresAt: null
    }]);
    prisma.targetResourceRegistration.findFirst.mockResolvedValue(target());

    await expect(service.issueRequesterToken(createMockRequest("Bearer agent-secret") as never, {
      grantType: "urn:authany:params:oauth:grant-type:requester-token",
      principalType: "agent",
      agentId: "agent_demo",
      runtimeId: "runtime_demo_cli",
      targetResource: "demo-target",
      externalContext: { provider: "demo-web" }
    })).resolves.toMatchObject({ requester_token: "access.jwt.1", token_type: "Bearer" });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "requester_token.issue",
      result: "success"
    }));
  });

  it("audits failed requester token attempts", async () => {
    const { audit, prisma, service } = createService();
    prisma.agentProfile.findFirst.mockResolvedValue({ id: "agent_db_1", agentId: "agent_demo", status: "active" });
    prisma.callerCredential.findMany.mockResolvedValue([]);

    await expectErrorCode(service.issueRequesterToken(createMockRequest("Bearer wrong") as never, {
      grantType: "urn:authany:params:oauth:grant-type:requester-token",
      principalType: "agent",
      agentId: "agent_demo",
      targetResource: "demo-target"
    }), "invalid_caller_credential");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "requester_token.issue",
      result: "denied",
      errorCode: "invalid_caller_credential"
    }));
  });

  it("issues an agent target token only after requester, connection, and grant checks pass", async () => {
    const { prisma, service } = createService();
    mockAgentRequester(prisma);
    prisma.targetResourceRegistration.findFirst.mockResolvedValue(target());
    prisma.targetConnection.findFirst.mockResolvedValue(connection());
    prisma.accessGrant.findFirst.mockResolvedValue(accessGrant());
    prisma.oAuthAccessTokenRecord.create.mockResolvedValue({});

    const result = await service.exchange(createRequesterRequest({
      ...agentRequesterClaims(),
      external_context: { provider: "demo-web", message_id: "msg_1" }
    }) as never, targetAccessRequest());

    expect(result).toMatchObject({ token_type: "Bearer", cache: "miss", jti: "jti-1" });
    expect(prisma.targetConnection.findFirst).toHaveBeenCalled();
    expect(prisma.accessGrant.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ connectionId: "connection_db_1", effect: "allow" })
    });
  });

  it("does not reuse a cached target token after access grant is revoked", async () => {
    const { prisma, service } = createService();
    mockAgentRequester(prisma);
    prisma.targetResourceRegistration.findFirst.mockResolvedValue(target());
    prisma.targetConnection.findFirst.mockResolvedValue(connection());
    prisma.accessGrant.findFirst.mockResolvedValueOnce(accessGrant()).mockResolvedValueOnce(null);
    prisma.oAuthAccessTokenRecord.create.mockResolvedValue({});

    await service.exchange(createRequesterRequest({ ...agentRequesterClaims(), request_id: "request_1" }) as never, targetAccessRequest());
    await expectErrorCode(
      service.exchange(createRequesterRequest({ ...agentRequesterClaims(), request_id: "request_2" }) as never, targetAccessRequest()),
      "access_not_allowed",
    );
  });

  it("rejects requests when no target connection exists", async () => {
    const { prisma, service } = createService();
    mockAgentRequester(prisma);
    prisma.targetResourceRegistration.findFirst.mockResolvedValue(target());
    prisma.targetConnection.findFirst.mockResolvedValue(null);

    await expectErrorCode(
      service.exchange(createRequesterRequest(agentRequesterClaims()) as never, targetAccessRequest()),
      "connection_not_allowed",
    );
  });

  it("enforces external context provider policy", async () => {
    const { prisma, service } = createService();
    mockAgentRequester(prisma);
    prisma.targetResourceRegistration.findFirst.mockResolvedValue(target());
    prisma.targetConnection.findFirst.mockResolvedValue({
      ...connection(),
      allowedContextProvidersJson: ["lark"]
    });

    await expectErrorCode(
      service.exchange(createRequesterRequest({
        ...agentRequesterClaims(),
        external_context: { provider: "demo-web" }
      }) as never, targetAccessRequest()),
      "invalid_external_context",
    );
  });

  it("does not accept naked body identity without a requester JWT", async () => {
    const { service } = createService();
    await expectErrorCode(service.exchange(createMockRequest() as never, targetAccessRequest()), "invalid_requester_jwt");
  });

  it("rejects target mismatch between body and signed requester JWT", async () => {
    const { service } = createService();
    await expectErrorCode(
      service.exchange(createRequesterRequest({ ...agentRequesterClaims(), target_resource: "other-target" }) as never, targetAccessRequest()),
      "invalid_requester_jwt",
    );
  });

  it("rejects AuthAny tokens that are not requester assertions", async () => {
    const { service } = createService();
    await expectErrorCode(
      service.exchange(createRequesterRequest({ ...agentRequesterClaims(), token_use: "target_access" }) as never, targetAccessRequest()),
      "invalid_requester_jwt",
    );
  });

  it("does not mask internal requester JWT verification failures as invalid_requester_jwt", async () => {
    const { service } = createService({
      tokenSigner: {
        ...createMockTokenSigner(),
        verify: vi.fn(async () => {
          throw new Error("database offline");
        })
      }
    });

    await expect(service.exchange(createRequesterRequest(agentRequesterClaims()) as never, targetAccessRequest())).rejects.toThrow("database offline");
  });

  it("issues an application target token from signed requester identity", async () => {
    const { prisma, service } = createService();
    prisma.targetResourceRegistration.findFirst.mockResolvedValue(target());
    prisma.oAuthClient.findFirst.mockResolvedValue({
      id: "app_db_1",
      clientId: "app_live_demo",
      status: "active",
      secrets: [{ id: "secret_1", status: "active", expiresAt: null }]
    });
    prisma.targetConnection.findFirst.mockResolvedValue({ ...connection(), principalType: "application" });
    prisma.accessGrant.findFirst.mockResolvedValue(accessGrant());
    prisma.oAuthAccessTokenRecord.create.mockResolvedValue({});

    await expect(service.exchange(createRequesterRequest({
      sub: "app:app_live_demo",
      app_id: "app_live_demo",
      secret_id: "secret_1",
      target_resource: "demo-target",
      request_id: "request_app_1",
      token_use: "requester_assertion"
    }) as never, targetAccessRequest())).resolves.toMatchObject({ token_type: "Bearer", cache: "miss" });
  });

  it("persists target token state even when cache backend errors during issuance", async () => {
    const { prisma, service } = createService({
      redis: {
        get: vi.fn(async () => { throw new Error("redis down"); }),
        set: vi.fn(async () => undefined),
        setIfAbsent: vi.fn(async () => true),
        delete: vi.fn(async () => undefined)
      }
    });
    mockAgentRequester(prisma);
    prisma.targetResourceRegistration.findFirst.mockResolvedValue(target());
    prisma.targetConnection.findFirst.mockResolvedValue(connection());
    prisma.accessGrant.findFirst.mockResolvedValue(accessGrant());
    prisma.oAuthAccessTokenRecord.create.mockResolvedValue({});

    const result = await service.exchange(createRequesterRequest(agentRequesterClaims()) as never, targetAccessRequest());

    expect(result.cache).toBe("backend_error");
    expect(prisma.oAuthAccessTokenRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jti: "jti-1",
        tokenType: "target_access_token",
        audience: "demo-target",
        scope: "target_access"
      })
    });
  });
});

function createService(overrides: {
  redis?: ReturnType<typeof createRedis>;
  tokenSigner?: ReturnType<typeof createMockTokenSigner>;
} = {}) {
  const prisma = createMockPrisma();
  const config = createMockConfig();
  const tokenSigner = overrides.tokenSigner ?? createMockTokenSigner();
  const hashes = new HashService();
  const redis = overrides.redis ?? createRedis();
  const audit = { record: vi.fn(async (input) => prisma.auditEvent.create({ data: input })) };
  const metrics = { increment: vi.fn() };
  const rateLimit = { assertAllowed: vi.fn(async () => undefined) };
  const policy = new DelegationPolicyService(prisma as never, config as never);
  const callerCredentials = new CallerCredentialService(prisma as never, config as never, hashes);
  const service = new DelegationService(
    new RequesterTokenService(
      config as never,
      prisma as never,
      callerCredentials,
      audit as never,
      rateLimit as never,
      tokenSigner as never,
      hashes,
      policy,
    ),
    new TargetTokenExchangeService(
      config as never,
      prisma as never,
      callerCredentials,
      new ReplayProtectionService(redis as never, config as never, metrics as never),
      new TargetTokenBrokerService(config as never, redis as never, createMockTokenSigner() as never, createMockSecretEncryption()),
      audit as never,
      metrics as never,
      rateLimit as never,
      tokenSigner as never,
      policy,
    ),
  );
  return { audit, prisma, service };
}

function targetAccessRequest() {
  return {
    grantType: "urn:authany:params:oauth:grant-type:target-access",
    targetResource: "demo-target"
  };
}

function agentRequesterClaims() {
  return {
    sub: "agent:agent_demo",
    agent_id: "agent_demo",
    runtime_id: "runtime_demo_cli",
    target_resource: "demo-target",
    request_id: "request_1",
    credential_id: "credential_1",
    token_use: "requester_assertion"
  };
}

function createRequesterRequest(payload: Record<string, unknown>) {
  return createMockRequest(`Bearer ${mockRequesterJwt(payload)}`);
}

function mockAgentRequester(prisma: ReturnType<typeof createMockPrisma>) {
  prisma.agentProfile.findFirst.mockResolvedValue({ id: "agent_db_1", agentId: "agent_demo", status: "active" });
  prisma.runtimeRegistration.findFirst.mockResolvedValue({ id: "runtime_db_1", runtimeId: "runtime_demo_cli", agentId: "agent_db_1", status: "active" });
  prisma.callerCredential.findFirst.mockResolvedValue({
    id: "credential_1",
    agentId: "agent_db_1",
    runtimeRegistrationId: "runtime_db_1",
    status: "active",
    expiresAt: null,
    agent: { id: "agent_db_1", agentId: "agent_demo", status: "active" },
    runtime: { id: "runtime_db_1", runtimeId: "runtime_demo_cli", agentId: "agent_db_1", status: "active" }
  });
}

function target() {
  return { id: "target_db_1", targetResourceCode: "demo-target", audience: "demo-target" };
}

function connection() {
  return {
    id: "connection_db_1",
    connectionId: "tc_demo",
    externalContextMode: "optional",
    allowedContextProvidersJson: ["demo-web"],
    maxTokenTtlSeconds: 900
  };
}

function accessGrant() {
  return { id: "grant_db_1", grantId: "ag_demo", status: "active" };
}

function createRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    setIfAbsent: vi.fn(async (key: string, value: string) => {
      if (store.has(key)) return false;
      store.set(key, value);
      return true;
    }),
    delete: vi.fn(async (key: string) => { store.delete(key); })
  };
}

async function expectErrorCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error("Expected promise to reject.");
  } catch (error) {
    expect(getErrorCode(error)).toBe(code);
  }
}
