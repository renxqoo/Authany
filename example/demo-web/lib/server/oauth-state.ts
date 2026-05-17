import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getDemoEnv } from "./env";

export interface DemoOAuthState {
  state: string;
  verifier: string;
  redirectUri: string;
  expiresAt: number;
}

const cookieName = "authany_demo_oauth";

export function writeDemoOAuthState(response: NextResponse, state: DemoOAuthState) {
  response.cookies.set(cookieName, encodeState(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(1, Math.floor((state.expiresAt - Date.now()) / 1000))
  });
}

export async function readDemoOAuthState() {
  const raw = (await cookies()).get(cookieName)?.value;
  if (!raw) {
    return null;
  }
  const state = decodeState(raw);
  return state && state.expiresAt > Date.now() ? state : null;
}

export function clearDemoOAuthState(response: NextResponse) {
  response.cookies.delete(cookieName);
}

function encodeState(state: DemoOAuthState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeState(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DemoOAuthState;
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
