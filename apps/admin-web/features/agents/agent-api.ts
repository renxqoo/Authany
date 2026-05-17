import { adminFetch } from "@/lib/api/admin-client";
import type { AgentCredential, AgentDetail, AgentSummary } from "./types";

export function listAgents(input: { query?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (input.query?.trim()) {
    params.set("q", input.query.trim());
  }
  if (input.status?.trim()) {
    params.set("status", input.status.trim());
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return adminFetch<AgentSummary[]>(`agents${suffix}`);
}

export function createAgent(input: {
  description?: string;
  name: string;
}) {
  return adminFetch<AgentDetail>("agents", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getAgent(id: string) {
  return adminFetch<AgentDetail>(`agents/${id}`);
}

export function updateAgent(id: string, input: {
  description?: string;
  name: string;
  status: string;
}) {
  return adminFetch<AgentDetail>(`agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteAgent(id: string, confirmName: string) {
  return adminFetch<{ id: string; status: string }>(`agents/${id}/delete`, {
    method: "POST",
    body: JSON.stringify({ confirm_name: confirmName })
  });
}

export function issueCallerCredential(id: string, input: { runtime_id?: string }) {
  return adminFetch<{ caller_credential: string; credential: AgentCredential }>(`agents/${id}/credentials`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function revokeCallerCredential(id: string) {
  return adminFetch<AgentCredential>(`credentials/${id}/revoke`, {
    method: "POST",
    body: JSON.stringify({})
  });
}
