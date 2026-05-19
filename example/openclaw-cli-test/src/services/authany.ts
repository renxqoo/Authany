import type { CliEnv } from "../types.js";

export async function resolveTargetAccessToken(env: CliEnv) {
  if (!env.injectedTargetAccessToken) {
    throw new Error(
      "AUTHANY_TARGET_ACCESS_TOKEN is required for protected authany-stock commands.",
    );
  }

  return {
    accessToken: env.injectedTargetAccessToken,
    mode: "injected_target_token" as const
  };
}
