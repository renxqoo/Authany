import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { TargetTokenVerifier } from "../src/index.js";

describe("TargetTokenVerifier", () => {
  const issuer = "https://authany.example.com";
  const audience = "order-service";
  const targetResource = "order-service";

  it("verifies a valid agent token", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    const claims = await verifier.verify(token);

    expect(claims.agent_id).toBe("agent-1");
    expect(claims.sub).toBe("agent:agent-1");
  });

  it("verifies a valid application token", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "app:app-1",
      app_id: "app-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    const claims = await verifier.verify(token);

    expect(claims.app_id).toBe("app-1");
  });

  it("returns external_context as-is", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource,
      external_context: { provider: "lark", message_id: "msg-1" }
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    const claims = await verifier.verify(token);

    expect(claims.external_context).toEqual({ provider: "lark", message_id: "msg-1" });
  });

  it("rejects tokens signed by the wrong key", async () => {
    const trustedKey = await createSigningKey();
    const untrustedKey = await createSigningKey("untrusted-key");
    const token = await signToken(untrustedKey.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience, trustedKey.kid);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(trustedKey.jwk)
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "invalid_token"
    });
  });

  it("rejects malformed JWT strings", async () => {
    const key = await createSigningKey();
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify("not-a-jwt")).rejects.toMatchObject({
      code: "invalid_token"
    });
  });

  it("rejects issuer mismatches", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, "https://other-issuer.example.com", audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "invalid_token"
    });
  });

  it("rejects audience mismatches", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, "other-service");
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "invalid_token"
    });
  });

  it("rejects expired tokens outside clock tolerance", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience, key.kid, Math.floor(Date.now() / 1000) - 10, Math.floor(Date.now() / 1000) - 6);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "invalid_token"
    });
  });

  it("rejects invalid token_use values", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "requester_assertion",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "invalid_token_use"
    });
  });

  it("rejects subject and agent_id mismatches", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-2",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "subject_mismatch"
    });
  });

  it("rejects subject and app_id mismatches", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "app:app-1",
      app_id: "app-2",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "subject_mismatch"
    });
  });

  it("rejects tokens without agent_id or app_id", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "invalid_principal"
    });
  });

  it("rejects target_resource mismatches", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: "other-service"
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "target_resource_mismatch"
    });
  });

  it("surfaces JWKS fetch failures", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network down"))
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "jwks_fetch_failed"
    });
  });

  it("accepts slightly expired tokens within clock tolerance", async () => {
    const key = await createSigningKey();
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience, key.kid, now - 30, now - 2);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      clockToleranceSeconds: 5,
      fetch: createJwksFetch(key.jwk)
    });

    const claims = await verifier.verify(token);

    expect(claims.agent_id).toBe("agent-1");
  });

  it("rejects missing tokens before any JWKS work", async () => {
    const key = await createSigningKey();
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    await expect(verifier.verify("   ")).rejects.toMatchObject({
      code: "missing_token"
    });
  });

  it("accepts audience arrays", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience: [audience, "backup-service"],
      targetResource,
      fetch: createJwksFetch(key.jwk)
    });

    const claims = await verifier.verify(token);

    expect(claims.sub).toBe("agent:agent-1");
  });

  it("rejects invalid constructor config", async () => {
    const key = await createSigningKey();
    expect(() => new TargetTokenVerifier({
      issuer: "",
      audience,
      fetch: createJwksFetch(key.jwk)
    })).toThrow("issuer is required.");
    expect(() => new TargetTokenVerifier({
      issuer,
      audience: "   ",
      fetch: createJwksFetch(key.jwk)
    })).toThrow("audience is required.");
  });

  it("requires a fetch implementation when the runtime does not provide one", async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", undefined);
    try {
      expect(() => new TargetTokenVerifier({
        issuer,
        audience
      })).toThrow("A fetch implementation is required.");
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });

  it("treats blank targetResource config as optional", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource: "   ",
      fetch: createJwksFetch(key.jwk)
    });

    const claims = await verifier.verify(token);

    expect(claims.target_resource).toBe(targetResource);
  });

  it("surfaces non-200 JWKS responses as fetch failures", async () => {
    const key = await createSigningKey();
    const token = await signToken(key.privateKey, {
      sub: "agent:agent-1",
      agent_id: "agent-1",
      token_use: "target_access",
      target_resource: targetResource
    }, issuer, audience);
    const verifier = new TargetTokenVerifier({
      issuer,
      audience,
      targetResource,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", { status: 503 }))
    });

    await expect(verifier.verify(token)).rejects.toMatchObject({
      code: "jwks_fetch_failed"
    });
  });
});

async function createSigningKey(kid = "test-key") {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  return {
    kid,
    publicKey,
    privateKey,
    jwk: {
      ...jwk,
      kid,
      alg: "RS256",
      use: "sig"
    }
  };
}

async function signToken(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
  issuer: string,
  audience: string,
  kid = "test-key",
  issuedAt = Math.floor(Date.now() / 1000),
  expiresAt = issuedAt + 300,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setJti("jti-1")
    .sign(privateKey);
}

function createJwksFetch(jwk: Record<string, unknown>): typeof fetch {
  return vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({
    keys: [jwk]
  }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300"
    }
  }));
}
