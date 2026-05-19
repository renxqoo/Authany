import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuthAnyClient,
  AuthAnyConnectionError,
  AuthAnyTimeoutError,
  REQUESTER_TOKEN_GRANT_TYPE,
  TARGET_ACCESS_GRANT_TYPE,
  TargetTokenError
} from "../src/index.js";

describe("AuthAnyClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs a full agent exchange and maps the target token result", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        requester_token: "requester-1",
        token_type: "Bearer",
        expires_in: 300
      }))
      .mockResolvedValueOnce(jsonResponse({
        access_token: "target-1",
        token_type: "Bearer",
        expires_in: 900,
        issued_token_type: "target_access_token",
        cache: "hit",
        jti: "jti-1"
      }));
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    const result = await client.exchangeTargetToken("order-service");

    expect(result).toEqual({
      accessToken: "target-1",
      tokenType: "Bearer",
      expiresIn: 900,
      issuedTokenType: "target_access_token",
      cache: "hit",
      jti: "jti-1"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends app_id for application exchanges", async () => {
    const fetchMock = createSuccessfulExchangeFetch();
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "app-secret",
      principalType: "application",
      appId: "app-1",
      fetch: fetchMock
    });

    await client.exchangeTargetToken("order-service");

    const requesterBody = parseJsonBody(fetchMock.mock.calls[0]?.[1]?.body);
    expect(requesterBody.app_id).toBe("app-1");
    expect(requesterBody.agent_id).toBeUndefined();
  });

  it("includes runtime_id when configured", async () => {
    const fetchMock = createSuccessfulExchangeFetch();
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      runtimeId: "runtime-1",
      fetch: fetchMock
    });

    await client.exchangeTargetToken("order-service");

    const requesterBody = parseJsonBody(fetchMock.mock.calls[0]?.[1]?.body);
    expect(requesterBody.runtime_id).toBe("runtime-1");
  });

  it("forwards external_context to requester-token", async () => {
    const fetchMock = createSuccessfulExchangeFetch();
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    await client.exchangeTargetToken("order-service", {
      externalContext: { provider: "lark", message_id: "msg-1" }
    });

    const requesterBody = parseJsonBody(fetchMock.mock.calls[0]?.[1]?.body);
    expect(requesterBody.external_context).toEqual({ provider: "lark", message_id: "msg-1" });
  });

  it("returns a plain access token through getAccessToken", async () => {
    const fetchMock = createSuccessfulExchangeFetch();
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    const token = await client.getAccessToken("order-service");

    expect(token).toBe("target-1");
  });

  it("uses the caller credential for requester-token authorization", async () => {
    const fetchMock = createSuccessfulExchangeFetch();
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    await client.exchangeTargetToken("order-service");

    expect(readHeader(fetchMock.mock.calls[0]?.[1]?.headers, "authorization")).toBe("Bearer secret-1");
  });

  it("sends the requester-token grant type", async () => {
    const fetchMock = createSuccessfulExchangeFetch();
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    await client.exchangeTargetToken("order-service");

    const requesterBody = parseJsonBody(fetchMock.mock.calls[0]?.[1]?.body);
    expect(requesterBody.grant_type).toBe(REQUESTER_TOKEN_GRANT_TYPE);
  });

  it("uses the requester token for target-token authorization", async () => {
    const fetchMock = createSuccessfulExchangeFetch();
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    await client.exchangeTargetToken("order-service");

    expect(readHeader(fetchMock.mock.calls[1]?.[1]?.headers, "authorization")).toBe("Bearer requester-1");
  });

  it("sends the target-token grant type", async () => {
    const fetchMock = createSuccessfulExchangeFetch();
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    await client.exchangeTargetToken("order-service");

    const targetBody = parseJsonBody(fetchMock.mock.calls[1]?.[1]?.body);
    expect(targetBody.grant_type).toBe(TARGET_ACCESS_GRANT_TYPE);
  });

  it("throws RequesterTokenError when requester-token fails", async () => {
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
        code: "invalid_caller_credential",
        message: "caller credential is invalid"
      }, 401))
    });

    await expect(client.exchangeTargetToken("order-service")).rejects.toMatchObject({
      name: "RequesterTokenError",
      code: "invalid_caller_credential",
      statusCode: 401
    });
  });

  it("throws TargetTokenError when target-token fails", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        requester_token: "requester-1",
        token_type: "Bearer",
        expires_in: 300
      }))
      .mockResolvedValueOnce(jsonResponse({
        code: "access_not_allowed",
        message: "no grant"
      }, 403));
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    await expect(client.exchangeTargetToken("order-service")).rejects.toMatchObject({
      name: "TargetTokenError",
      code: "access_not_allowed",
      statusCode: 403
    });
  });

  it("wraps network failures as AuthAnyConnectionError", async () => {
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network down"))
    });

    await expect(client.exchangeTargetToken("order-service")).rejects.toBeInstanceOf(AuthAnyConnectionError);
  });

  it("wraps timed out requests as AuthAnyTimeoutError", async () => {
    const fetchMock = vi.fn<typeof fetch>((_, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      timeoutMs: 20,
      fetch: fetchMock
    });

    await expect(client.exchangeTargetToken("order-service")).rejects.toBeInstanceOf(AuthAnyTimeoutError);
  });

  it("does not reuse requester tokens after a failed second hop", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        requester_token: "requester-1",
        token_type: "Bearer",
        expires_in: 300
      }))
      .mockResolvedValueOnce(jsonResponse({
        code: "replay_protection_unavailable",
        message: "retry the full exchange"
      }, 503))
      .mockResolvedValueOnce(jsonResponse({
        requester_token: "requester-2",
        token_type: "Bearer",
        expires_in: 300
      }))
      .mockResolvedValueOnce(jsonResponse({
        access_token: "target-2",
        token_type: "Bearer",
        expires_in: 900,
        issued_token_type: "target_access_token",
        cache: "miss",
        jti: "jti-2"
      }));
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    await expect(client.exchangeTargetToken("order-service")).rejects.toBeInstanceOf(TargetTokenError);
    const token = await client.getAccessToken("order-service");

    expect(token).toBe("target-2");
    expect(readHeader(fetchMock.mock.calls[1]?.[1]?.headers, "authorization")).toBe("Bearer requester-1");
    expect(readHeader(fetchMock.mock.calls[3]?.[1]?.headers, "authorization")).toBe("Bearer requester-2");
  });

  it("rejects missing agentId for agent clients", () => {
    expect(() => new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "",
      fetch: vi.fn<typeof fetch>()
    })).toThrow("agentId is required.");
  });

  it("rejects missing appId for application clients", () => {
    expect(() => new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "application",
      appId: "",
      fetch: vi.fn<typeof fetch>()
    })).toThrow("appId is required.");
  });

  it("surfaces invalid response payloads", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        requester_token: "requester-1",
        token_type: "Bearer",
        expires_in: 300
      }))
      .mockResolvedValueOnce(jsonResponse({
        access_token: "target-1",
        token_type: "Bearer",
        expires_in: "bad-value",
        issued_token_type: "target_access_token",
        cache: "hit",
        jti: "jti-1"
      }));
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: fetchMock
    });

    await expect(client.exchangeTargetToken("order-service")).rejects.toThrow(
      "AuthAny response field expires_in is invalid."
    );
  });

  it("parses non-json API errors", async () => {
    const client = new AuthAnyClient({
      issuer: "https://authany.example.com",
      callerCredential: "secret-1",
      principalType: "agent",
      agentId: "agent-1",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("plain failure", { status: 500 }))
    });

    await expect(client.exchangeTargetToken("order-service")).rejects.toMatchObject({
      code: "http_error",
      message: "plain failure"
    });
  });

  it("requires a fetch implementation when the runtime does not provide one", () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", undefined);
    try {
      expect(() => new AuthAnyClient({
        issuer: "https://authany.example.com",
        callerCredential: "secret-1",
        principalType: "agent",
        agentId: "agent-1"
      })).toThrow("A fetch implementation is required.");
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });
});

function createSuccessfulExchangeFetch() {
  return vi.fn<typeof fetch>()
    .mockResolvedValueOnce(jsonResponse({
      requester_token: "requester-1",
      token_type: "Bearer",
      expires_in: 300
    }))
    .mockResolvedValueOnce(jsonResponse({
      access_token: "target-1",
      token_type: "Bearer",
      expires_in: 900,
      issued_token_type: "target_access_token",
      cache: "hit",
      jti: "jti-1"
    }));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function parseJsonBody(body: unknown) {
  return JSON.parse(String(body)) as Record<string, unknown>;
}

function readHeader(headers: unknown, name: string) {
  const normalizedName = name.toLowerCase();
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === normalizedName);
    return entry?.[1];
  }
  if (headers && typeof headers === "object") {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === normalizedName) {
        return String(value);
      }
    }
  }
  return undefined;
}
