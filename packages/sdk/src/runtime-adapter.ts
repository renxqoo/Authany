import { spawn } from "node:child_process";
import type {
  AuthorizedEnvOptions,
  AuthorizedRuntimeConfig,
  AuthAnyRequestOptions,
  CommandRunOptions,
  CommandRunResult,
  TargetTokenIssuer,
  TargetTokenResult
} from "./types.js";

const DEFAULT_TOKEN_ENV_NAME = "AUTHANY_TARGET_ACCESS_TOKEN";
const RESERVED_ENV_NAMES = new Set([
  "AUTHANY_CALLER_CREDENTIAL",
  "AUTHANY_AGENT_ID",
  "AUTHANY_APP_ID",
  "AUTHANY_RUNTIME_ID",
  "AUTHANY_URL",
  "AUTHANY_ISSUER",
  "DEMO_AGENT_CREDENTIAL",
  DEFAULT_TOKEN_ENV_NAME
]);

export class AuthorizedRuntime {
  private readonly client: TargetTokenIssuer;
  private readonly tokenEnvName: string;

  constructor(config: AuthorizedRuntimeConfig) {
    this.client = config.client;
    this.tokenEnvName = config.tokenEnvName?.trim() || DEFAULT_TOKEN_ENV_NAME;
  }

  issue(targetResource: string, options?: AuthAnyRequestOptions) {
    return this.client.exchangeTargetToken(targetResource, options);
  }

  async buildAuthorizedEnv(
    targetResource: string,
    options: AuthorizedEnvOptions = {},
  ): Promise<Record<string, string>> {
    const token = await this.issue(targetResource, options);
    return buildEnv(options.baseEnv, options.tokenEnvName ?? this.tokenEnvName, token.accessToken);
  }

  async runCommand(
    command: string,
    args: string[],
    options: CommandRunOptions,
  ): Promise<CommandRunResult> {
    const token = await this.issue(options.targetResource, {
      externalContext: options.externalContext,
      signal: options.signal
    });
    const env = buildEnv(options.env, this.tokenEnvName, token.accessToken);
    return runChildProcess(command, args, options, env, token);
  }
}

function buildEnv(
  baseEnv: NodeJS.ProcessEnv | Record<string, string | undefined> | undefined,
  tokenEnvName: string,
  accessToken: string,
) {
  const env = cloneStringEnv(baseEnv);
  for (const reservedName of RESERVED_ENV_NAMES) {
    delete env[reservedName];
  }
  delete env[tokenEnvName];
  env[tokenEnvName] = accessToken;
  return env;
}

function cloneStringEnv(baseEnv: NodeJS.ProcessEnv | Record<string, string | undefined> | undefined) {
  const env: Record<string, string> = {};
  if (!baseEnv) {
    return env;
  }
  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  return env;
}

function runChildProcess(
  command: string,
  args: string[],
  options: CommandRunOptions,
  env: Record<string, string>,
  token: TargetTokenResult,
): Promise<CommandRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env,
      stdio: "pipe"
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const onAbort = () => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("Command execution aborted."));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      reject(error);
    });

    child.once("close", (exitCode, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      resolve({
        exitCode,
        stdout,
        stderr,
        signal: signal ?? undefined,
        token
      });
    });

    if (options.stdin !== undefined) {
      child.stdin?.write(options.stdin);
    }
    child.stdin?.end();
  });
}
