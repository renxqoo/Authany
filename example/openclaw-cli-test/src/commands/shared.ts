import { resolveCliEnv } from "../services/env.js";
import {
  fetchProtectedTargetServiceResource,
  fetchPublicTargetServiceResource,
} from "../services/target-service.js";

export async function runProtectedResourceCommand(
  path: string,
  input: {
    params?: Record<string, string | number | undefined>;
    query?: Record<string, string | number | undefined>;
    targetServiceUrl?: string;
  } = {},
) {
  const env = resolveCliEnv({ targetServiceUrl: input.targetServiceUrl });
  const result = await fetchProtectedTargetServiceResource(
    env,
    interpolatePath(path, input.params),
    input.query,
  );

  if (result.status >= 400) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return result;
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

export async function runPublicResourceCommand(
  path: string,
  input: {
    query?: Record<string, string | number | undefined>;
    targetServiceUrl?: string;
  } = {},
) {
  const env = resolveCliEnv({ targetServiceUrl: input.targetServiceUrl });
  const result = await fetchPublicTargetServiceResource(
    env.targetServiceUrl,
    path,
    input.query,
  );

  if (result.status >= 400) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return result;
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function interpolatePath(
  path: string,
  params: Record<string, string | number | undefined> = {},
) {
  return path.replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing required path param "${key}" for "${path}".`);
    }
    return encodeURIComponent(String(value));
  });
}
