import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getDemoEnv } from "./env";

export interface DemoSession {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  scope?: string;
  userInfo?: Record<string, unknown>;
}

export async function setDemoSession(session: DemoSession) {
  const env = getDemoEnv();
  const cookieStore = await cookies();
  cookieStore.set(env.cookieName, encodeSession(session), sessionCookieOptions(session.expiresAt));
}

export function writeDemoSessionCookie(response: NextResponse, session: DemoSession) {
  response.cookies.set(getDemoEnv().cookieName, encodeSession(session), sessionCookieOptions(session.expiresAt));
}

export async function clearDemoSession() {
  const cookieStore = await cookies();
  cookieStore.delete(getDemoEnv().cookieName);
}

export async function readDemoSession() {
  const raw = (await cookies()).get(getDemoEnv().cookieName)?.value;
  if (!raw) {
    return null;
  }
  const session = decodeSession(raw);
  if (!session || session.expiresAt <= Date.now()) {
    return null;
  }
  return session;
}

function encodeSession(session: DemoSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function sessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(1, Math.floor((expiresAt - Date.now()) / 1000))
  };
}

function decodeSession(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DemoSession;
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", getDemoEnv().sessionSecret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
