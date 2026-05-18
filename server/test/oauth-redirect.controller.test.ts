import { describe, expect, it, vi } from "vitest";
import { OidcController } from "../src/modules/oidc/oidc.controller";
import type { OidcService } from "../src/modules/oidc/oidc.service";
import type { CurrentOperatorService } from "../src/shared/security/current-user.service";

describe("OAuth redirect handling", () => {
  it("redirects unauthenticated authorize requests to hosted login with a real 302 status", async () => {
    const reply = createReply();
    const controller = createController({
      currentOperator: { resolveOperatorId: vi.fn(async () => null) },
      oidc: { createAuthorizationCode: vi.fn() }
    });

    await controller.authorize(
      authorizeQuery(),
      createRequest(),
      reply as never,
    );

    expect(reply.status).toHaveBeenCalledWith(302);
    expect(reply.header).toHaveBeenCalledWith("location", expect.stringContaining("/login?return_to="));
    expect(decodeURIComponent(reply.location())).toContain("/oauth/authorize?");
    expect(reply.send).toHaveBeenCalled();
  });

  it("redirects authenticated authorize requests back to the OAuth client with a real 302 status", async () => {
    const reply = createReply();
    const redirectUrl = "http://127.0.0.1:5173/callback?code=code_1&state=state_1";
    const controller = createController({
      currentOperator: { resolveOperatorId: vi.fn(async () => "operator_1") },
      oidc: { createAuthorizationCode: vi.fn(async () => redirectUrl) }
    });

    await controller.authorize(
      authorizeQuery(),
      createRequest(),
      reply as never,
    );

    expect(reply.status).toHaveBeenCalledWith(302);
    expect(reply.header).toHaveBeenCalledWith("location", redirectUrl);
    expect(reply.send).toHaveBeenCalled();
  });
});

function createController(options: {
  currentOperator: Pick<CurrentOperatorService, "resolveOperatorId">;
  oidc: Pick<OidcService, "createAuthorizationCode">;
}) {
  return new OidcController(
    options.oidc as OidcService,
    options.currentOperator as CurrentOperatorService,
    { resolve: () => "127.0.0.1" } as never,
    { issue: () => "csrf-token", verify: () => true } as never,
  );
}

function authorizeQuery() {
  return {
    response_type: "code",
    client_id: "demo-web",
    redirect_uri: "http://127.0.0.1:5173/callback",
    scope: "openid profile",
    state: "state_1",
    code_challenge: "challenge",
    code_challenge_method: "S256"
  };
}

function createRequest() {
  return {
    protocol: "http",
    hostname: "127.0.0.1:3000",
    url: "/oauth/authorize?response_type=code&client_id=demo-web&redirect_uri=http%3A%2F%2F127.0.0.1%3A5173%2Fcallback&scope=openid+profile&state=state_1&code_challenge=challenge&code_challenge_method=S256"
  } as never;
}

function createReply() {
  const headers = new Map<string, string>();
  const reply = {
    status: vi.fn(() => reply),
    header: vi.fn((name: string, value: string) => {
      headers.set(name, value);
      return reply;
    }),
    send: vi.fn(() => reply),
    location: () => headers.get("location") ?? ""
  };
  return reply;
}
