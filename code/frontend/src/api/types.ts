export type ExtractionStatus = "active" | "indexing" | "paused" | "error";
export type AggregationStatus = "active" | "generating" | "error";

export interface Extraction {
  id: string;
  name: string;
  description: string;
  extraction_instructions: string;
  extraction_schema: string | null;
  status: ExtractionStatus;
  extraction_error: string | null;
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

export interface Aggregation {
  id: string;
  name: string;
  description: string;
  extraction_id: string;
  aggregation_query: string;
  aggregation_pipeline: string | null;
  aggregation_error: string | null;
  status: AggregationStatus;
  created_at: string;
  updated_at: string;
}

export interface QueryResult {
  results: Record<string, unknown>[];
  pipeline: string;
}

export interface ChatResponse {
  response: string;
  data: Record<string, unknown>[] | null;
  query: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown>[] | null;
}

export interface CreateExtractionPayload {
  name: string;
  description?: string;
  extraction_instructions: string;
  extraction_schema?: string;
}

export interface CreateAggregationPayload {
  name: string;
  description?: string;
  extraction_id: string;
  aggregation_query: string;
}
