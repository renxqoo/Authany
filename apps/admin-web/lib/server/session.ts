import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAdminEnv } from "./env";

export interface AdminSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export async function setAdminSession(session: AdminSession) {
  const env = getAdminEnv();
  const cookieStore = await cookies();
  cookieStore.set(env.cookieName, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000))
  });
}

export async function clearAdminSession() {
  const env = getAdminEnv();
  const cookieStore = await cookies();
  cookieStore.delete(env.cookieName);
}

export async function readAdminSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(getAdminEnv().cookieName)?.value;
  if (!raw) {
    return null;
  }
  const session = decodeSession(raw);
  if (!session || session.expiresAt <= Date.now()) {
    return null;
  }
  return session;
}

function encodeSession(session: AdminSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", getAdminEnv().sessionSecret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
