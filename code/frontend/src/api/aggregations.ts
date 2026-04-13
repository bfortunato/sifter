import type { Aggregation, CreateAggregationPayload } from "./types";

const BASE = "/api/aggregations";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const fetchAggregations = (extractionId?: string): Promise<Aggregation[]> => {
  const url = extractionId ? `${BASE}?extraction_id=${extractionId}` : BASE;
  return fetch(url).then((r) => handleResponse<Aggregation[]>(r));
};

export const fetchAggregation = (id: string): Promise<Aggregation> =>
  fetch(`${BASE}/${id}`).then((r) => handleResponse<Aggregation>(r));

export const createAggregation = (payload: CreateAggregationPayload): Promise<Aggregation> =>
  fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => handleResponse<Aggregation>(r));

export const fetchAggregationResult = (id: string): Promise<{ results: Record<string, unknown>[] }> =>
  fetch(`${BASE}/${id}/result`).then((r) =>
    handleResponse<{ results: Record<string, unknown>[] }>(r)
  );

export const deleteAggregation = (id: string): Promise<void> =>
  fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handleResponse<void>(r));
