import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadSharedExampleEnv();

export interface TargetServiceEnv {
  port: number;
  issuer: string;
  audience: string;
  targetResource: string;
}

export function getTargetServiceEnv(): TargetServiceEnv {
  const port = requiredNumberEnv("TARGET_SERVICE_PORT");
  const issuer = requiredEnv("AUTHANY_ISSUER");
  const audience = requiredEnv("TARGET_SERVICE_AUDIENCE");
  const targetResource = requiredEnv("TARGET_RESOURCE_CODE");
  return {
    port,
    issuer,
    audience,
    targetResource
  };
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }
  throw new Error(`${name} is required for example target-service.`);
}

function requiredNumberEnv(name: string) {
  const raw = requiredEnv(name);
  const value = Number(raw);
  if (Number.isInteger(value) && value > 0) {
    return value;
  }
  throw new Error(`${name} must be a positive integer for example target-service.`);
}

function loadSharedExampleEnv() {
  const sharedEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");

  let source = "";
  try {
    source = readFileSync(sharedEnvPath, "utf8");
  } catch {
    return;
  }

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
