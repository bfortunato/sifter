import { apiFetchJson } from "../lib/apiFetch";
import type { Aggregation, AggregationResult, CreateAggregationPayload } from "./types";

const BASE = "/api/aggregations";

export const fetchAggregations = (extractionId?: string): Promise<Aggregation[]> => {
  const url = extractionId ? `${BASE}?extraction_id=${extractionId}` : BASE;
  return apiFetchJson<Aggregation[]>(url);
};

export const fetchAggregation = (id: string): Promise<Aggregation> =>
  apiFetchJson<Aggregation>(`${BASE}/${id}`);

export const createAggregation = (payload: CreateAggregationPayload): Promise<Aggregation> =>
  apiFetchJson<Aggregation>(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const fetchAggregationResult = (id: string): Promise<AggregationResult> =>
  apiFetchJson<AggregationResult>(`${BASE}/${id}/result`);

export const regenerateAggregation = (id: string): Promise<Aggregation> =>
  apiFetchJson<Aggregation>(`${BASE}/${id}/regenerate`, { method: "POST" });

export const deleteAggregation = (id: string): Promise<void> =>
  apiFetchJson<void>(`${BASE}/${id}`, { method: "DELETE" });
