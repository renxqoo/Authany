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
