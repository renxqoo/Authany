"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import { AuthModePanel } from "@/components/demo/auth-mode-panel";
import { LarkEbfxPanel } from "@/components/demo/lark-ebfx-panel";
import { SessionPanel } from "@/components/demo/session-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DemoSession {
  authenticated: boolean;
  expiresAt?: number;
  scope?: string;
  userInfo?: Record<string, unknown>;
  tokens?: Record<string, string>;
}

export default function HomePage() {
  const [session, setSession] = useState<DemoSession>({ authenticated: false });
  const [oauthError, setOauthError] = useState("");

  async function loadSession() {
    setSession(await fetch("/api/demo/session").then((item) => item.json()));
  }

  useEffect(() => {
    let active = true;
    const error = new URLSearchParams(window.location.search).get("error");
    void Promise.resolve().then(() => {
      if (active && error) {
        setOauthError(error);
      }
    });
    void fetch("/api/demo/session")
      .then((item) => item.json())
      .then((data) => {
        if (active) {
          setSession(data);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/demo/logout", { method: "POST" });
    await loadSession();
  }

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/75 p-8 shadow-xl shadow-sky-950/5 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">AuthAny Demo Web</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Business app using demo-web</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              AuthAny Authorization Playground: Hosted application login, Application Target Token,
              Agent Target Token, and Lark/OpenClaw external context passthrough.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 p-4 text-white"><ShieldCheck size={34} /></div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-950">Sign in through AuthAny</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Click through to AuthAny Hosted Login, then approve the consent page.
            </p>
            {oauthError ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                OAuth returned: {oauthError}
              </div>
            ) : null}
            <a
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              href="/api/demo/login"
            >
              <LogIn size={18} /> Continue with AuthAny
            </a>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Current session</h2>
                <p className="mt-2 text-sm text-slate-500">Tokens are redacted before rendering.</p>
              </div>
              {session.authenticated ? <Button onClick={logout} type="button" variant="secondary"><LogOut size={18} /> Sign out</Button> : null}
            </div>
            <SessionPanel session={session} />
          </Card>
        </div>
        <AuthModePanel authenticated={session.authenticated} />
        <LarkEbfxPanel />
      </div>
    </main>
  );
}
