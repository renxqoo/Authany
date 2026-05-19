import type { CliEnv } from "../types.js";
import { DEFAULT_TARGET_SERVICE_URL } from "../config.js";

export function resolveCliEnv(
  overrides: { targetServiceUrl?: string; defaultTargetServiceUrl?: string } = {},
): CliEnv {
  return {
    injectedTargetAccessToken: readOptionalEnv("AUTHANY_TARGET_ACCESS_TOKEN"),
    targetServiceUrl: resolveTargetServiceUrl(
      overrides.targetServiceUrl,
      overrides.defaultTargetServiceUrl ?? DEFAULT_TARGET_SERVICE_URL,
    )
  };
}

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function resolveTargetServiceUrl(override: string | undefined, defaultTargetServiceUrl: string) {
  return (
    override
    ?? readOptionalEnv("TARGET_SERVICE_URL")
    ?? readOptionalEnv("DEMO_TARGET_SERVICE_URL")
    ?? defaultTargetServiceUrl
  );
}
