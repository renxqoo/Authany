"use client";

import { useState } from "react";
import { DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TargetResourcePanelProps {
  authenticated: boolean;
}

export function TargetResourcePanel({ authenticated }: TargetResourcePanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  async function loadTargetResource() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/demo/target-resource");
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(body.message ?? `Target resource access failed. HTTP ${response.status}`);
    }
    setResult(body);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Target service resource</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Demo Web asks AuthAny for a target access token, then calls the protected demo-target service.
        </p>
      </div>
      <Button disabled={!authenticated || loading} onClick={loadTargetResource} type="button">
        <DatabaseZap size={18} /> {loading ? "Requesting target resource..." : "Access demo-target resource"}
      </Button>
      {!authenticated ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
          Sign in first, then request target-service data.
        </div>
      ) : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {result ? (
        <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
