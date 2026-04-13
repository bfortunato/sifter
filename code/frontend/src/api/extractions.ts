import type {
  Extraction,
  ExtractionRecord,
  QueryResult,
  CreateExtractionPayload,
} from "./types";

const BASE = "/api/extractions";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const fetchExtractions = (): Promise<Extraction[]> =>
  fetch(BASE).then((r) => handleResponse<Extraction[]>(r));

export const fetchExtraction = (id: string): Promise<Extraction> =>
  fetch(`${BASE}/${id}`).then((r) => handleResponse<Extraction>(r));

export const createExtraction = (payload: CreateExtractionPayload): Promise<Extraction> =>
  fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => handleResponse<Extraction>(r));

export const deleteExtraction = (id: string): Promise<void> =>
  fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handleResponse<void>(r));

export const uploadDocuments = (id: string, formData: FormData): Promise<unknown> =>
  fetch(`${BASE}/${id}/upload`, { method: "POST", body: formData }).then((r) =>
    handleResponse<unknown>(r)
  );

export const reindexExtraction = (id: string): Promise<unknown> =>
  fetch(`${BASE}/${id}/reindex`, { method: "POST" }).then((r) => handleResponse<unknown>(r));

export const resetExtraction = (id: string): Promise<Extraction> =>
  fetch(`${BASE}/${id}/reset`, { method: "POST" }).then((r) => handleResponse<Extraction>(r));

export const fetchExtractionRecords = (id: string): Promise<ExtractionRecord[]> =>
  fetch(`${BASE}/${id}/records`).then((r) => handleResponse<ExtractionRecord[]>(r));

export const exportExtractionCsv = async (id: string, name: string): Promise<void> => {
  const res = await fetch(`${BASE}/${id}/records/csv`);
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
  fetch(`${BASE}/${id}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  }).then((r) => handleResponse<QueryResult>(r));
