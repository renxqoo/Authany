import { adminFetch } from "@/lib/api/admin-client";
import type { ApplicationDetail, ApplicationSummary } from "./types";

export function listApplications(input: { query?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (input.query?.trim()) {
    params.set("q", input.query.trim());
  }
  if (input.status?.trim()) {
    params.set("status", input.status.trim());
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return adminFetch<ApplicationSummary[]>(`applications${suffix}`);
}

export function createApplication(input: { name: string; description?: string; redirect_uris: string[] }) {
  return adminFetch<ApplicationDetail>("applications", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getApplication(id: string) {
  return adminFetch<ApplicationDetail>(`applications/${id}`);
}

export function updateApplication(id: string, input: {
  name: string;
  description?: string;
  redirect_uris?: string[];
  status?: string;
}) {
  return adminFetch<ApplicationDetail>(`applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function revealApplicationSecret(id: string, secretId: string) {
  return adminFetch<{ app_secret: string }>(`applications/${id}/secrets/${secretId}/reveal`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function rotateApplicationSecret(id: string) {
  return adminFetch<{ app_secret: string; hint: string; secret_id: string }>(`applications/${id}/secrets/rotate`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function deleteApplication(id: string, confirmName: string) {
  return adminFetch<{ id: string; status: string }>(`applications/${id}/delete`, {
    method: "POST",
    body: JSON.stringify({ confirm_name: confirmName })
  });
}
