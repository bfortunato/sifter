import { apiFetch, apiFetchJson } from "../lib/apiFetch";

export interface Webhook {
  id: string;
  organization_id: string;
  events: string[];
  url: string;
  sift_id: string | null;
  created_at: string;
}

export const fetchWebhooks = (): Promise<Webhook[]> =>
  apiFetchJson<Webhook[]>("/api/webhooks");

export const createWebhook = (payload: {
  events: string[];
  url: string;
  sift_id?: string;
}): Promise<Webhook> =>
  apiFetchJson<Webhook>("/api/webhooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const deleteWebhook = async (hookId: string): Promise<void> => {
  await apiFetch(`/api/webhooks/${hookId}`, { method: "DELETE" });
};
