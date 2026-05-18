import { adminFetch } from "@/lib/api/admin-client";

export function revealApplicationSecret(id: string, secretId: string) {
  return adminFetch<{ app_secret: string }>(`applications/${id}/secrets/${secretId}/reveal`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function rotateApplicationSecret(id: string) {
  return adminFetch<{ app_secret: string; hint: string; secret_id: string }>(`applications/${id}/secrets/rotate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
