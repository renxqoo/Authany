const baseUrl = requiredEnv("AUTHANY_BASE_URL");

async function main() {
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
}

async function readCode(response: Response) {
  try {
    const body = await response.json() as { code?: string };
    return body.code ?? "";
  } catch {
    return "";
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }
  throw new Error(`${name} must be set before running security-verify.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
