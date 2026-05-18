import { describe, expect, it, vi } from "vitest";
import { TargetTokenBrokerService } from "../src/modules/delegation/delegation-token-broker.service";
import { createMockConfig, createMockTokenSigner } from "./test-helpers";
import { createMockSecretEncryption } from "./security-test-helpers";

describe("TargetTokenBrokerService", () => {
  it("reuses cached target tokens for the same authorized context", async () => {
    const redis = createRedis();
    const signer = createMockTokenSigner();
    const broker = new TargetTokenBrokerService(createMockConfig() as never, redis as never, signer as never, createMockSecretEncryption());

    const first = await broker.getOrIssue({ context: context(), claims: claims(), ttlSeconds: 900 });
    const second = await broker.getOrIssue({ context: context(), claims: claims(), ttlSeconds: 900 });

    expect(first.cache).toBe("miss");
    expect(second).toMatchObject({ cache: "hit", access_token: first.access_token, jti: first.jti });
    expect(signer.signWithMetadata).toHaveBeenCalledTimes(1);
  });

  it("isolates cache entries by connection, grant, credential, runtime, and external context", async () => {
    const redis = createRedis();
    const signer = createMockTokenSigner();
    const broker = new TargetTokenBrokerService(createMockConfig() as never, redis as never, signer as never, createMockSecretEncryption());

    await broker.getOrIssue({ context: context(), claims: claims(), ttlSeconds: 900 });
    await broker.getOrIssue({ context: { ...context(), grantId: "grant_2" }, claims: claims(), ttlSeconds: 900 });
    await broker.getOrIssue({ context: { ...context(), externalContextDigest: "ctx_2" }, claims: claims(), ttlSeconds: 900 });

    expect(signer.signWithMetadata).toHaveBeenCalledTimes(3);
  });

  it("reports backend_error when Redis reads fail and still issues a fresh token", async () => {
    const signer = createMockTokenSigner();
    const redis = {
      get: vi.fn(async () => { throw new Error("redis down"); }),
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined)
    };
    const broker = new TargetTokenBrokerService(createMockConfig() as never, redis as never, signer as never, createMockSecretEncryption());

    await expect(broker.getOrIssue({ context: context(), claims: claims(), ttlSeconds: 900 })).resolves.toMatchObject({
      cache: "backend_error"
    });
  });
});

function context() {
  return {
    principalType: "agent" as const,
    principalId: "agent_demo",
    audience: "demo-target",
    connectionId: "connection_db_1",
    credentialId: "credential_1",
    grantId: "grant_1",
    runtimeId: "runtime_1",
    targetId: "target_1",
    targetResource: "demo-target",
    externalContextDigest: "ctx_1"
  };
}

function claims() {
  return {
    sub: "agent:agent_demo",
    aud: "demo-target",
    agent_id: "agent_demo",
    token_use: "target_access"
  };
}

function createRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); })
  };
}
