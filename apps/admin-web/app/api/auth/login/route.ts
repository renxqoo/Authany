import { NextResponse } from "next/server";
import { loginWithPassword } from "@/lib/server/oauth-login";
import { setAdminSession } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    if (!body.username || !body.password) {
      return NextResponse.json({ code: "invalid_request", message: "Username and password are required." }, { status: 400 });
    }
    const token = await loginWithPassword({ username: body.username, password: body.password });
    await setAdminSession({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000
    });
    return NextResponse.json({ code: "ok" });
  } catch (error) {
    return NextResponse.json({
      code: "login_failed",
      message: error instanceof Error ? error.message : "Login failed."
    }, { status: 401 });
  }
}
