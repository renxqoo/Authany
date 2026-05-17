import { NextResponse } from "next/server";
import { getAdminEnv } from "@/lib/server/env";
import { readAdminSession } from "@/lib/server/session";

type Params = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Params) {
  return proxy(request, context);
}

export async function POST(request: Request, context: Params) {
  return proxy(request, context);
}

export async function PATCH(request: Request, context: Params) {
  return proxy(request, context);
}

async function proxy(request: Request, context: Params) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ code: "invalid_admin_token", message: "Admin session is required." }, { status: 401 });
  }

  const { path } = await context.params;
  const url = new URL(request.url);
  const upstream = new URL(`/api/v1/admin/${path.join("/")}${url.search}`, getAdminEnv().authanyBaseUrl);
  const body = request.method === "GET" ? undefined : await request.text();
  const response = await fetch(upstream, {
    method: request.method,
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      "content-type": request.headers.get("content-type") ?? "application/json"
    },
    body
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
