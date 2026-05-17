"use client";

import { useState } from "react";
import type React from "react";
import { Bot, DatabaseZap, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JsonBlock } from "./session-panel";

interface AuthModePanelProps {
  authenticated: boolean;
}

type ResultMap = Record<string, unknown>;

export function AuthModePanel({ authenticated }: AuthModePanelProps) {
  const [loading, setLoading] = useState("");
  const [results, setResults] = useState<ResultMap>({});

  async function run(key: string, url: string) {
    setLoading(key);
    const response = await fetch(url);
    const body = await response.json().catch(() => ({}));
    setResults((current) => ({
      ...current,
      [key]: {
        httpStatus: response.status,
        ...body
      }
    }));
    setLoading("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <ModeCard
        description="需要操作员先完成 Hosted 授权登录。demo-web 服务端用 App Secret 换 Requester JWT，再换 Application Target Token。"
        disabled={!authenticated || loading === "application"}
        icon={<DatabaseZap size={20} />}
        loading={loading === "application"}
        onRun={() => run("application", "/api/demo/target-resource")}
        result={results.application}
        title="Application Server 访问"
      />
      <ModeCard
        description="不需要操作员登录。demo-web 模拟 OpenClaw/CLI 使用 Agent Caller Credential 获取 Agent Target Token。"
        disabled={loading === "agent"}
        icon={<Bot size={20} />}
        loading={loading === "agent"}
        onRun={() => run("agent", "/api/demo/agent-resource")}
        result={results.agent}
        title="Agent Only 访问"
      />
      <ModeCard
        description="故意使用错误 Agent 凭证，演示 AuthAny 如何拒绝无效调用方。"
        disabled={loading === "failure"}
        icon={<ShieldAlert size={20} />}
        loading={loading === "failure"}
        onRun={() => run("failure", "/api/demo/failure")}
        result={results.failure}
        title="失败路径演示"
      />
    </div>
  );
}

function ModeCard(props: {
  description: string;
  disabled: boolean;
  icon: React.ReactNode;
  loading: boolean;
  onRun: () => void;
  result: unknown;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-sky-950/5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-slate-950 p-3 text-white">{props.icon}</div>
        <h2 className="text-lg font-semibold text-slate-950">{props.title}</h2>
      </div>
      <p className="mt-4 min-h-16 text-sm leading-6 text-slate-500">{props.description}</p>
      <Button className="mt-5 w-full" disabled={props.disabled} onClick={props.onRun} type="button">
        {props.loading ? "Running..." : "Run demo"}
      </Button>
      {props.result ? <div className="mt-5"><JsonBlock label="Result" value={props.result} /></div> : null}
    </section>
  );
}
