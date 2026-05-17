import "reflect-metadata";
import { readFileSync } from "node:fs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";

async function main() {
  loadBaseEnv();
  requireRuntimeSecrets();
  requireEnv("PORT");

  const [{ AppModule }, { AppConfigService }, { HttpExceptionFilter }, { createCorsOptions, createHelmetOptions }] = await Promise.all([
    import("../dist/src/app.module.js"),
    import("../dist/src/shared/config/app-config.service.js"),
    import("../dist/src/shared/http/http-exception.filter.js"),
    import("../dist/src/shared/http/security-headers.js")
  ]);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: false }),
  );
  const config = app.get(AppConfigService);
  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(helmet, createHelmetOptions(config));
  app.enableCors(createCorsOptions(config));
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidUnknownValues: true,
    forbidNonWhitelisted: true
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(config.port, "127.0.0.1");

  try {
    const baseUrl = `http://127.0.0.1:${config.port}`;
    const loginStatuses: Array<{ attempt: number; status: number; code: string }> = [];
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `10.0.0.${attempt}`
        },
        body: JSON.stringify({
          username: "security-probe-user",
          password: `wrong-password-${attempt}`
        })
      });
      loginStatuses.push({
        attempt,
        status: response.status,
        code: await readCode(response)
      });
    }

    let tokenRateLimitedAt = 0;
    for (let attempt = 1; attempt <= 65; attempt += 1) {
      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `172.16.0.${attempt}`
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: `probe-client-${attempt}`,
          client_secret: "wrong-secret"
        })
      });
      if (response.status === 429) {
        tokenRateLimitedAt = attempt;
        break;
      }
    }

    console.log(JSON.stringify({
      baseUrl,
      loginStatuses,
      tokenRateLimitedAt
    }, null, 2));
  } finally {
    await app.close();
  }
}

function loadBaseEnv() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    if (value !== "") {
      process.env[key] = value;
    }
  }
}

function requireRuntimeSecrets() {
  requireEnv("AUTHANY_APP_SECRET_ENCRYPTION_KEY");
}

async function readCode(response: Response) {
  try {
    const body = await response.json() as { code?: string };
    return body.code ?? "";
  } catch {
    return "";
  }
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }
  throw new Error(`${name} must be set before running security-attack-harness.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
