import { describe, expect, it, vi } from "vitest";
import { AuthorizedRuntime } from "../src/index.js";
import type { TargetTokenIssuer } from "../src/types.js";

describe("AuthorizedRuntime", () => {
  it("injects a short-lived token into the child env", async () => {
    const runtime = new AuthorizedRuntime({
      client: createIssuer("token-1")
    });

    const env = await runtime.buildAuthorizedEnv("order-service", {
      baseEnv: { PATH: "/usr/bin" }
    });

    expect(env.PATH).toBe("/usr/bin");
    expect(env.AUTHANY_TARGET_ACCESS_TOKEN).toBe("token-1");
  });

  it("does not leak the long-lived caller credential", async () => {
    const runtime = new AuthorizedRuntime({
      client: createIssuer("token-1")
    });

    const env = await runtime.buildAuthorizedEnv("order-service", {
      baseEnv: {
        AUTHANY_CALLER_CREDENTIAL: "long-lived",
        AUTHANY_AGENT_ID: "agent-1",
        PATH: "/usr/bin"
      }
    });

    expect(env.AUTHANY_CALLER_CREDENTIAL).toBeUndefined();
    expect(env.AUTHANY_AGENT_ID).toBeUndefined();
    expect(env.PATH).toBe("/usr/bin");
  });

  it("supports a custom token env name", async () => {
    const runtime = new AuthorizedRuntime({
      client: createIssuer("token-1"),
      tokenEnvName: "EBFX_ACCESS_TOKEN"
    });

    const env = await runtime.buildAuthorizedEnv("order-service");

    expect(env.EBFX_ACCESS_TOKEN).toBe("token-1");
    expect(env.AUTHANY_TARGET_ACCESS_TOKEN).toBeUndefined();
  });

  it("delegates issue calls to the underlying client", async () => {
    const exchangeTargetToken = vi.fn<TargetTokenIssuer["exchangeTargetToken"]>()
      .mockResolvedValue(tokenResult("token-1"));
    const runtime = new AuthorizedRuntime({
      client: { exchangeTargetToken }
    });

    await runtime.issue("order-service", {
      externalContext: { provider: "lark" }
    });

    expect(exchangeTargetToken).toHaveBeenCalledWith("order-service", {
      externalContext: { provider: "lark" }
    });
  });

  it("runs a command with the injected token", async () => {
    const runtime = new AuthorizedRuntime({
      client: createIssuer("token-1")
    });

    const result = await runtime.runCommand(process.execPath, [
      "-e",
      "process.stdout.write(process.env.AUTHANY_TARGET_ACCESS_TOKEN || '')"
    ], {
      targetResource: "order-service",
      env: {
        AUTHANY_CALLER_CREDENTIAL: "long-lived"
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("token-1");
    expect(result.stderr).toBe("");
    expect(result.token.accessToken).toBe("token-1");
  });

  it("forwards stdin into the child process", async () => {
    const runtime = new AuthorizedRuntime({
      client: createIssuer("token-1")
    });

    const result = await runtime.runCommand(process.execPath, [
      "-e",
      "process.stdin.on('data', (chunk) => process.stdout.write(String(chunk)))"
    ], {
      targetResource: "order-service",
      stdin: "hello-runtime"
    });

    expect(result.stdout).toBe("hello-runtime");
  });

  it("rejects aborted command executions", async () => {
    const runtime = new AuthorizedRuntime({
      client: createIssuer("token-1")
    });
    const controller = new AbortController();

    const runPromise = runtime.runCommand(process.execPath, [
      "-e",
      "setTimeout(() => process.stdout.write('late'), 1000)"
    ], {
      targetResource: "order-service",
      signal: controller.signal
    });
    controller.abort();

    await expect(runPromise).rejects.toThrow("Command execution aborted.");
  });

  it("rejects spawn failures", async () => {
    const runtime = new AuthorizedRuntime({
      client: createIssuer("token-1")
    });

    await expect(runtime.runCommand("/definitely-missing-command", [], {
      targetResource: "order-service"
    })).rejects.toBeInstanceOf(Error);
  });

  it("returns isolated env objects across calls", async () => {
    const tokens = ["token-1", "token-2"];
    const runtime = new AuthorizedRuntime({
      client: {
        exchangeTargetToken: vi.fn<TargetTokenIssuer["exchangeTargetToken"]>()
          .mockResolvedValueOnce(tokenResult(tokens[0]))
          .mockResolvedValueOnce(tokenResult(tokens[1]))
      }
    });

    const env1 = await runtime.buildAuthorizedEnv("order-service");
    const env2 = await runtime.buildAuthorizedEnv("order-service");

    expect(env1).not.toBe(env2);
    expect(env1.AUTHANY_TARGET_ACCESS_TOKEN).toBe(tokens[0]);
    expect(env2.AUTHANY_TARGET_ACCESS_TOKEN).toBe(tokens[1]);
  });
});

function createIssuer(accessToken: string): TargetTokenIssuer {
  return {
    exchangeTargetToken: vi.fn(async () => tokenResult(accessToken))
  };
}

function tokenResult(accessToken: string) {
  return {
    accessToken,
    tokenType: "Bearer" as const,
    expiresIn: 900,
    issuedTokenType: "target_access_token",
    cache: "hit" as const,
    jti: `jti-${accessToken}`
  };
}
