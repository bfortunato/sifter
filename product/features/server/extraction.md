---
title: "Server: Document Extraction (Sifts)"
status: synced
version: "1.1"
last-modified: "2026-04-16T00:00:00.000Z"
---

# Document Extraction — Server

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sifts` | Create new sift (also creates its default folder) |
| GET | `/api/sifts` | List sifts (`?limit=50&offset=0`) |
| GET | `/api/sifts/{id}` | Get sift details (includes `default_folder_id`) |
| PATCH | `/api/sifts/{id}` | Update sift (name, description, instructions, schema) |
| DELETE | `/api/sifts/{id}` | Delete sift + results |
| POST | `/api/sifts/{id}/upload` | Upload documents directly to sift (routed to default folder) |
| POST | `/api/sifts/{id}/reindex` | Reindex all documents |
| POST | `/api/sifts/{id}/reset` | Reset error state |
| GET | `/api/sifts/{id}/records` | Get extracted records (`?limit=100&offset=0`) |
| GET | `/api/sifts/{id}/records/csv` | Export records as CSV |

Auth required on all endpoints: JWT Bearer or `X-API-Key` header.

## Sift Model

Key fields returned by `GET /api/sifts/{id}`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Sift ID |
| `name` | string | Sift name |
| `instructions` | string | Natural language extraction instructions |
| `schema` | string | Auto-inferred schema (e.g. "client (string), date (string), amount (number)") |
| `status` | string | `active` \| `indexing` \| `paused` \| `error` |
| `processed_documents` | int | Documents successfully processed |
| `total_documents` | int | Total documents enqueued |
| `default_folder_id` | string? | ID of the auto-created default folder; `null` for pre-existing sifts until their first direct upload |

## Processing Pipeline

1. User creates a sift with a name, description, and natural language instructions (e.g. "Extract: client name, invoice date, total amount, VAT number")
2. A **default folder** is created automatically with the same name as the sift and linked to it
3. Documents are uploaded either via **Folders** (see `server/documents.md`) or directly via `POST /api/sifts/{id}/upload` — both routes go through the same folder-document pipeline
4. Sifter processes each document asynchronously via the background queue
5. Sift schema is auto-inferred from the first processed document

## Sift Creation (`POST /api/sifts`)

On creation, the server performs the following steps atomically in sequence:

1. Persist the sift document in the `sifts` collection
2. Create a folder with the same name as the sift (no duplicate check — folder names are not unique)
3. Link the folder to the sift via `folder_extractors`
4. Update the sift with `default_folder_id = <new folder id>`

The response includes `default_folder_id`.

## Direct Upload (`POST /api/sifts/{id}/upload`)

Uploading directly to a sift routes files through the sift's **default folder**:

1. Read `default_folder_id` from the sift; create the folder lazily if `null` (for pre-existing sifts)
2. For each file: save to storage under `{folder_id}/{filename}`, create a `Document` record, enqueue for processing
3. Response: `{ "uploaded": N, "files": [...], "folder_id": "..." }`

Files uploaded this way are visible in the folder browser and benefit from the full folder pipeline: automatic retry (max 3), webhooks (`sift.document.processed`, `sift.error`), per-document status tracking, and concurrent worker processing.

> **Legacy note:** files uploaded to a sift before this change were stored under `{sift_id}/` with no `Document` records. They remain in blob storage but are not visible in the UI and cannot be migrated.

## Key Behaviors

- Each document produces one `SiftResult` record with `extracted_data` key-value pairs
- Fields not found in a document are set to `null`
- Numeric values stored as numbers, dates as ISO YYYY-MM-DD strings
- The sift tracks status: `active`, `indexing`, `paused`, `error`
- Progress tracked via `processed_documents` / `total_documents` counters
- Schema inference: after first document processed, generate a schema string like "client (string), date (string), amount (number)"
- A sift can have multiple folders linked to it (many-to-many via `folder_extractors`); `default_folder_id` identifies the one created automatically at sift creation
