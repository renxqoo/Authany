"use client";

import { useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginCard({ nextPath, noticeKey }: { nextPath: string; noticeKey?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: t("login.failed") }));
      setError(body.message);
      return;
    }
    router.push(nextPath);
  }

  return (
    <Card className="w-full max-w-5xl overflow-hidden rounded-[32px] border-white/80 bg-white/88">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden border-b border-slate-100/80 bg-[linear-gradient(150deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94)_55%,rgba(37,99,235,0.82))] p-8 text-white lg:border-b-0 lg:border-r lg:border-white/10 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.22),transparent_20rem),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.10),transparent_20rem)]" />
          <div className="relative">
            <div className="mb-6 inline-flex rounded-[22px] bg-white/12 p-3 text-white ring-1 ring-white/15"><ShieldCheck /></div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">{t("topbar.eyebrow")}</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">{t("login.title")}</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-200">{t("login.note")}</p>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <CardHeader className="border-b-0 px-0 pb-6 pt-0">
            <CardTitle>{t("login.submit")}</CardTitle>
            <p className="mt-2 text-sm text-slate-500">{t("app.subtitle")}</p>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            <form className="space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium text-slate-700">
                {t("login.username")}
                <Input className="mt-2" onChange={(event) => setUsername(event.target.value)} value={username} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {t("login.password")}
                <Input className="mt-2" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
              </label>
              {noticeKey ? <Alert>{t(noticeKey)}</Alert> : null}
              {error ? <Alert>{error}</Alert> : null}
              <Button className="mt-2 w-full" disabled={loading} type="submit">
                {loading ? t("login.submitting") : t("login.submit")}
              </Button>
            </form>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
