---
title: "Server: Document Extraction (Sifts)"
status: synced
---

# Document Extraction — Server

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sifts` | Create new sift |
| GET | `/api/sifts` | List sifts (`?limit=50&offset=0`) |
| GET | `/api/sifts/{id}` | Get sift details |
| PATCH | `/api/sifts/{id}` | Update sift (name, description, instructions, schema) |
| DELETE | `/api/sifts/{id}` | Delete sift + results |
| POST | `/api/sifts/{id}/upload` | Upload documents directly to sift (backward compat) |
| POST | `/api/sifts/{id}/reindex` | Reindex all documents |
| POST | `/api/sifts/{id}/reset` | Reset error state |
| GET | `/api/sifts/{id}/records` | Get extracted records (`?limit=100&offset=0`) |
| GET | `/api/sifts/{id}/records/csv` | Export records as CSV |

Auth required on all endpoints: JWT Bearer or `X-API-Key` header.

## Processing Pipeline

1. User creates a sift with a name, description, and natural language instructions (e.g. "Extract: client name, invoice date, total amount, VAT number")
2. Documents are uploaded via **Folders** (see `server/documents.md`) — upload a document to a folder linked to this sift to trigger automatic processing
3. Sifter processes each document asynchronously via the background queue
4. Sift schema is auto-inferred from the first processed document

## Key Behaviors

- Each document produces one `SiftResult` record with `extracted_data` key-value pairs
- Fields not found in a document are set to `null`
- Numeric values stored as numbers, dates as ISO YYYY-MM-DD strings
- The sift tracks status: `active`, `indexing`, `paused`, `error`
- Progress tracked via `processed_documents` / `total_documents` counters
- Schema inference: after first document processed, generate a schema string like "client (string), date (string), amount (number)"

## Direct Upload (Deprecated)

`POST /api/sifts/{id}/upload` is kept for backward compatibility but the preferred approach is uploading documents via Folders.
