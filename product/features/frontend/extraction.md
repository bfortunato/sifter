---
title: "Frontend: Document Extraction (Sifts)"
status: synced
---

# Document Extraction — Frontend

## Pages

### Sifts List (`/`)

- Table of sifts: name, status badge, document count, created date
- "New Sift" button opens a dialog: name + instructions textarea
- Status badges: `active` (green), `indexing` (yellow spinner), `paused` (grey), `error` (red)
- Click a row to navigate to Sift Detail

### Sift Detail (`/sifts/:id`)

Header bar:
- Sift name (inline editable)
- Status badge
- Instructions text (collapsed/expanded toggle)
- Schema display (auto-inferred)
- Progress bar (`processed_documents / total_documents`) while indexing
- Action buttons: Reindex, Reset (error state), Delete

Three tabs:

#### Records tab

- Table with one column per extracted field (schema-driven)
- Sortable columns
- "Export CSV" button → calls `GET /api/sifts/{id}/records/csv`, triggers download
- Pagination for large record sets
- Empty state when no documents have been processed yet

#### Query tab

See `frontend/query.md` for the query panel and `frontend/aggregations.md` for the named aggregations panel.

#### Chat tab

See `frontend/chat.md` for the scoped chat interface.

## Polling

While a sift has `status: indexing`, the page polls `GET /api/sifts/{id}` every 3 seconds to update the status badge and progress bar. Polling stops when status becomes `active` or `error`.
