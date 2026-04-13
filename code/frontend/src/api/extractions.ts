import { apiFetch, apiFetchJson } from "../lib/apiFetch";
import type {
  ChatResponse,
  CreateExtractionPayload,
  Extraction,
  ExtractionRecord,
  QueryResult,
} from "./types";

const BASE = "/api/extractions";

export const fetchExtractions = (): Promise<Extraction[]> =>
  apiFetchJson<Extraction[]>(BASE);

export const fetchExtraction = (id: string): Promise<Extraction> =>
  apiFetchJson<Extraction>(`${BASE}/${id}`);

export const createExtraction = (payload: CreateExtractionPayload): Promise<Extraction> =>
  apiFetchJson<Extraction>(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const deleteExtraction = (id: string): Promise<void> =>
  apiFetchJson<void>(`${BASE}/${id}`, { method: "DELETE" });

export const uploadDocuments = (id: string, formData: FormData): Promise<unknown> =>
  apiFetchJson<unknown>(`${BASE}/${id}/upload`, { method: "POST", body: formData });

export const reindexExtraction = (id: string): Promise<unknown> =>
  apiFetchJson<unknown>(`${BASE}/${id}/reindex`, { method: "POST" });

export const resetExtraction = (id: string): Promise<Extraction> =>
  apiFetchJson<Extraction>(`${BASE}/${id}/reset`, { method: "POST" });

export const fetchExtractionRecords = (id: string): Promise<ExtractionRecord[]> =>
  apiFetchJson<ExtractionRecord[]>(`${BASE}/${id}/records`);

export const exportExtractionCsv = async (id: string, name: string): Promise<void> => {
  const res = await apiFetch(`${BASE}/${id}/records/csv`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const queryExtraction = (id: string, query: string): Promise<QueryResult> =>
  apiFetchJson<QueryResult>(`${BASE}/${id}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

export const chatWithExtraction = (
  id: string,
  message: string,
  history: Array<{ role: string; content: string }>
): Promise<ChatResponse> =>
  apiFetchJson<ChatResponse>(`${BASE}/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
