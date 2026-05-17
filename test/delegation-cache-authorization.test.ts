import { describe, expect, it, vi } from "vitest";
import { TargetTokenBrokerService } from "../src/modules/delegation/delegation-token-broker.service";
import { createMockConfig, createMockTokenSigner } from "./test-helpers";
import { createMockSecretEncryption } from "./security-test-helpers";

describe("target token cache authorization boundaries", () => {
  it("includes target connection and access grant in the reusable cache key", async () => {
    const signer = createMockTokenSigner();
    const broker = new TargetTokenBrokerService(createMockConfig() as never, createRedis() as never, signer as never, createMockSecretEncryption());

    await broker.getOrIssue({ context: context("connection_1", "grant_1"), claims: claims(), ttlSeconds: 900 });
    await broker.getOrIssue({ context: context("connection_2", "grant_1"), claims: claims(), ttlSeconds: 900 });
    await broker.getOrIssue({ context: context("connection_1", "grant_2"), claims: claims(), ttlSeconds: 900 });

    expect(signer.signWithMetadata).toHaveBeenCalledTimes(3);
  });
});

function context(connectionId: string, grantId: string) {
  return {
    principalType: "agent" as const,
    principalId: "agent_demo",
    audience: "demo-target",
    connectionId,
    credentialId: "credential_1",
    grantId,
    runtimeId: "runtime_1",
    targetId: "target_1",
    targetResource: "demo-target"
  };
}

function claims() {
  return { sub: "agent:agent_demo", aud: "demo-target", agent_id: "agent_demo" };
}

function createRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); })
  };
}
