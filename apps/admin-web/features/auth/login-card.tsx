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
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-4 inline-flex rounded-2xl bg-slate-950 p-3 text-white"><ShieldCheck /></div>
        <CardTitle>{t("login.title")}</CardTitle>
        <p className="mt-2 text-sm text-slate-500">{t("login.note")}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            {t("login.username")}
            <Input className="mt-1" onChange={(event) => setUsername(event.target.value)} value={username} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {t("login.password")}
            <Input className="mt-1" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          {noticeKey ? <Alert>{t(noticeKey)}</Alert> : null}
          {error ? <Alert>{error}</Alert> : null}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
