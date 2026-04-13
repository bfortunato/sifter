import { apiFetch, apiFetchJson } from "../lib/apiFetch";
import {
  Document,
  DocumentExtractionStatus,
  Folder,
  FolderExtractor,
} from "./types";

// ---- Folders ----

export async function fetchFolders(): Promise<Folder[]> {
  return apiFetchJson<Folder[]>("/api/folders");
}

export async function fetchFolder(folderId: string): Promise<Folder & { extractors: FolderExtractor[] }> {
  return apiFetchJson(`/api/folders/${folderId}`);
}

export async function createFolder(
  name: string,
  description?: string
): Promise<Folder> {
  return apiFetchJson<Folder>("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description ?? "" }),
  });
}

export async function updateFolder(
  folderId: string,
  payload: { name?: string; description?: string }
): Promise<Folder> {
  return apiFetchJson<Folder>(`/api/folders/${folderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  await apiFetch(`/api/folders/${folderId}`, { method: "DELETE" });
}

// ---- Folder-Extractor Links ----

export async function fetchFolderExtractors(folderId: string): Promise<FolderExtractor[]> {
  return apiFetchJson<FolderExtractor[]>(`/api/folders/${folderId}/extractors`);
}

export async function linkExtractor(folderId: string, extractionId: string): Promise<FolderExtractor> {
  return apiFetchJson<FolderExtractor>(`/api/folders/${folderId}/extractors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extraction_id: extractionId }),
  });
}

export async function unlinkExtractor(folderId: string, extractionId: string): Promise<void> {
  await apiFetch(`/api/folders/${folderId}/extractors/${extractionId}`, {
    method: "DELETE",
  });
}

// ---- Documents ----

export interface DocumentWithStatuses {
  id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
  extraction_statuses: DocumentExtractionStatus[];
}

export async function fetchFolderDocuments(
  folderId: string
): Promise<DocumentWithStatuses[]> {
  return apiFetchJson<DocumentWithStatuses[]>(`/api/folders/${folderId}/documents`);
}

export async function uploadDocument(
  folderId: string,
  file: File
): Promise<{ id: string; filename: string; enqueued_for: string[] }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiFetch(`/api/folders/${folderId}/documents`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Upload failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchDocument(
  documentId: string
): Promise<Document & { extraction_statuses: DocumentExtractionStatus[] }> {
  return apiFetchJson(`/api/documents/${documentId}`);
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiFetch(`/api/documents/${documentId}`, { method: "DELETE" });
}

export async function reprocessDocument(
  documentId: string,
  extractionId?: string
): Promise<{ document_id: string; enqueued_for: string[] }> {
  return apiFetchJson(`/api/documents/${documentId}/reprocess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extraction_id: extractionId }),
  });
}
