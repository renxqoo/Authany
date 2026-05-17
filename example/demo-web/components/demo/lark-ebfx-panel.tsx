"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JsonBlock } from "./session-panel";

const AUTHORIZED_SENDER_ID = "ou_8d3de97c48f36f53b1f703dd59897f9f";
const UNAUTHORIZED_SENDER_ID = "ou_unauthorized_lark_user";

export function LarkEbfxPanel() {
  const [senderId, setSenderId] = useState(AUTHORIZED_SENDER_ID);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function run() {
    setLoading(true);
    const response = await fetch(`/api/demo/lark-ebfx-resource?sender_id=${encodeURIComponent(senderId)}`);
    const body = await response.json().catch(() => ({}));
    setResult({ httpStatus: response.status, ...body });
    setLoading(false);
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-600 p-3 text-white"><MessageCircle size={20} /></div>
            <h2 className="text-xl font-semibold text-slate-950">Lark User 授权 EBFX 资源访问</h2>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
            模拟 Lark 用户通过 OpenClaw/CLI 访问 EBFX。demo-web 不让用户登录 AuthAny，
            而是由 Agent Runtime 用 Caller Credential 获取 Requester JWT，并把 Lark sender_id 签进 external_context 交给 EBFX 判断。
          </p>
        </div>
        <Button disabled={loading} onClick={run} type="button">{loading ? "Running..." : "Run Lark demo"}</Button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="text-sm font-medium text-slate-700">
          Lark sender_id
          <input
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-sky-500"
            onChange={(event) => setSenderId(event.target.value)}
            value={senderId}
          />
        </label>
        <Button className="self-end" onClick={() => setSenderId(AUTHORIZED_SENDER_ID)} type="button" variant="secondary">Use authorized</Button>
        <Button className="self-end" onClick={() => setSenderId(UNAUTHORIZED_SENDER_ID)} type="button" variant="secondary">Use unauthorized</Button>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        已授权 sender 会通过 Agent Target Token 访问 target-service；未授权 sender 会返回 EBFX 授权链接，
        对应真实场景里把链接发回 Lark 用户完成业务系统授权。
      </div>

      {result ? <div className="mt-5"><JsonBlock label="Result" value={result} /></div> : null}
    </Card>
  );
}
