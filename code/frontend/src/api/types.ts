// ---- Auth ----

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface OrganizationMember {
  user_id: string;
  email: string;
  full_name: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

// ---- Sifts ----

export type SiftStatus = "active" | "indexing" | "paused" | "error";

export interface Sift {
  id: string;
  organization_id: string | null;
  name: string;
  description: string;
  instructions: string;
  schema: string | null;
  status: SiftStatus;
  error: string | null;
  processed_documents: number;
  total_documents: number;
  created_at: string;
  updated_at: string;
}

export interface ExtractionRecord {
  id: string;
  document_id: string;
  document_type: string;
  confidence: number;
  extracted_data: Record<string, unknown>;
  created_at: string;
}

export interface CreateSiftPayload {
  name: string;
  description?: string;
  instructions: string;
  schema?: string;
}

// ---- Aggregations ----

export type AggregationStatus = "generating" | "ready" | "active" | "error";

export interface Aggregation {
  id: string;
  organization_id: string | null;
  name: string;
  description: string;
  extraction_id: string;
  aggregation_query: string;
  pipeline: Record<string, unknown>[] | null;
  aggregation_error: string | null;
  status: AggregationStatus;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueryResult {
  results: Record<string, unknown>[];
  pipeline: Record<string, unknown>[];
}

export interface AggregationResult {
  results: Record<string, unknown>[];
  pipeline: Record<string, unknown>[];
  ran_at: string;
}

export interface CreateAggregationPayload {
  name: string;
  description?: string;
  extraction_id: string;
  aggregation_query: string;
}

// ---- Chat ----

export interface ChatResponse {
  response: string;
  data: Record<string, unknown>[] | null;
  query: string | null;
  pipeline: Record<string, unknown>[] | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>[] | null;
  pipeline?: Record<string, unknown>[] | null;
}

// ---- Folders & Documents ----

export interface Folder {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
}

export interface FolderExtractor {
  id: string;
  folder_id?: string;
  extraction_id: string;
  created_at: string;
}

export interface Document {
  id: string;
  organization_id: string;
  folder_id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
  storage_path?: string;
}

export interface DocumentExtractionStatus {
  id?: string;
  extraction_id: string;
  status: "pending" | "processing" | "done" | "error";
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  extraction_record_id: string | null;
}
