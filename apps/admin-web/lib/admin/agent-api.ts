import { adminFetch } from "@/lib/api/admin-client";

type AgentCredential = {
  credential_hint: string;
  credential_type: string;
  id: string;
  issued_at: string;
  last_used_at?: string | null;
  status: string;
};

export function issueCallerCredential(id: string, input: { runtime_id?: string }) {
  return adminFetch<{ caller_credential: string; credential: AgentCredential }>(`agents/${id}/credentials`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeCallerCredential(id: string) {
  return adminFetch<AgentCredential>(`credentials/${id}/revoke`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
