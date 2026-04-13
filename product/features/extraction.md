---
title: Document Extraction
status: synced
---

# Document Extraction

Users define extraction instructions that describe what structured fields to pull from documents. Sifter processes documents through an AI vision model and stores results in MongoDB, scoped to an organization.

## User Flow

1. User creates a sift with a name, description, and natural language instructions (e.g. "Extract: client name, invoice date, total amount, VAT number")
2. Documents are uploaded via **Folders** (see `documents.md`) — upload a document to a folder linked to this sift to trigger automatic processing
3. Sifter processes each document asynchronously via the background queue
4. Sift schema is auto-inferred from the first processed document
5. User can view extracted records as a structured table on the sift detail page
6. User can reindex all documents (useful when instructions change)
7. User can export records as CSV

## Key Behaviors

- Each document produces one `SiftResult` record with `extracted_data` key-value pairs
- Fields not found in a document are set to `null`
- Numeric values stored as numbers, dates as ISO YYYY-MM-DD strings
- The sift tracks status: `active`, `indexing`, `paused`, `error`
- Progress tracked via `processed_documents` / `total_documents` counters
- Schema inference: after first document processed, generate a schema string like "client (string), date (string), amount (number)"
- All sifts are scoped to an `organization_id` — only visible to authenticated members of that organization

## Direct Upload (Deprecated)

`POST /api/sifts/{id}/upload` is kept for backward compatibility but the preferred approach is uploading documents via Folders.

## Auth

All sift endpoints require authentication (JWT Bearer or `X-API-Key` header). Results are filtered by the caller's `organization_id`.

## Frontend Pages

- **Sifts** (`/`) — table of sifts with name, status badge, document count, created date; "New Sift" button
- **Sift Detail** (`/sifts/:id`) — three tabs:
  - *Records*: structured table of all extracted data, CSV export button
  - *Query*: ad-hoc natural language query + named aggregations
  - *Chat*: conversational interface scoped to this sift's data
  - Header: sift name (editable), status badge, instructions, schema, progress bar, Reindex / Reset / Delete buttons
