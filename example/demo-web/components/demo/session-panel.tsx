"use client";

interface DemoSession {
  authenticated: boolean;
  expiresAt?: number;
  scope?: string;
  userInfo?: Record<string, unknown>;
  tokens?: Record<string, string>;
}

export function SessionPanel({ session }: { session: DemoSession }) {
  if (!session.authenticated) {
    return <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No demo-web session yet.</div>;
  }

  return (
    <div className="mt-6 space-y-4">
      <InfoRow label="Status" value="Authenticated" />
      <InfoRow label="Scope" value={session.scope ?? "-"} />
      <InfoRow label="Expires at" value={session.expiresAt ? new Date(session.expiresAt).toLocaleString() : "-"} />
      <JsonBlock label="UserInfo" value={session.userInfo} />
      <JsonBlock label="Token previews" value={session.tokens} />
    </div>
  );
}

export function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-slate-600">{label}</div>
      <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{JSON.stringify(value ?? {}, null, 2)}</pre>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
      <span className="font-medium text-slate-600">{label}</span>
      <span className="text-slate-950">{value}</span>
    </div>
  );
}
