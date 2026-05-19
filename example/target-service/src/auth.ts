import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { JWTPayload } from "jose";
import { SignJWT, jwtVerify } from "jose";
import type { TargetAccessClaims } from "@authany/sdk";
import type { FastifyRequest } from "fastify";

// ── Types ────────────────────────────────────────────────────────────────

export interface LocalAccessClaims extends JWTPayload {
  iss: "target-service-local";
  sub: string;
  username: string;
  display_name: string;
  token_use: "local_access";
  exp: number;
  iat: number;
  jti: string;
}

export type AnyAccessClaims = TargetAccessClaims | LocalAccessClaims;

export function isLocalClaims(claims: AnyAccessClaims): claims is LocalAccessClaims {
  return claims.iss === "target-service-local";
}

// ── JWT signing & verification ───────────────────────────────────────────

interface SignLocalParams {
  userId: number;
  username: string;
  displayName: string;
}

export async function signLocalAccessToken(
  params: SignLocalParams,
  jwtSecret: string,
): Promise<string> {
  const secret = new TextEncoder().encode(jwtSecret);
  return new SignJWT({
    sub: `user:${params.userId}`,
    username: params.username,
    display_name: params.displayName,
    token_use: "local_access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("target-service-local")
    .setIssuedAt()
    .setExpirationTime("8h")
    .setJti(randomUUID())
    .sign(secret);
}

export async function verifyLocalAccessToken(
  token: string,
  jwtSecret: string,
): Promise<LocalAccessClaims> {
  const secret = new TextEncoder().encode(jwtSecret);
  const { payload } = await jwtVerify(token, secret, {
    issuer: "target-service-local",
  });
  return payload as LocalAccessClaims;
}

export function isLocalToken(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload: JWTPayload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return payload.iss === "target-service-local";
  } catch {
    return false;
  }
}

// ── Password hashing ────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomUUID();
  const derived = scryptSync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const separatorIndex = storedHash.indexOf(":");
  if (separatorIndex <= 0) return false;
  const salt = storedHash.slice(0, separatorIndex);
  const storedKey = storedHash.slice(separatorIndex + 1);
  const derived = scryptSync(password, salt, 64);
  const derivedHex = derived.toString("hex");
  if (derivedHex.length !== storedKey.length) return false;
  return timingSafeEqual(Buffer.from(derivedHex), Buffer.from(storedKey));
}

// ── Token extraction ────────────────────────────────────────────────────

export function extractToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    for (const pair of cookieHeader.split(";")) {
      const [name, ...rest] = pair.split("=");
      if (name.trim() === "token") {
        return rest.join("=").trim();
      }
    }
  }

  return null;
}
