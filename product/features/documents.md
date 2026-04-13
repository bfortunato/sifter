---
title: Folders & Document Management
status: synced
---

# Folders & Document Management

Advanced document management organises files in a hierarchy:
**Organization → Folders → Documents → Sift Results**

## Folders

A Folder is a named container for documents within an organization.
- Has a name and optional description
- Can be linked to one or more Sifts
- Documents uploaded to a folder are automatically processed by **all linked sifts**
- Tracks document count

## Documents

A Document represents an uploaded file stored in Sifter:
- Stored on the filesystem at `{storage_path}/{org_id}/{folder_id}/{filename}`
- Has metadata: filename, content type, size, upload timestamp, uploaded_by user
- Each `(document, sift)` pair has an independent processing status

## Folder ↔ Sift Links

The `FolderSift` link connects a folder to a sift (many-to-many):
- A folder can be linked to multiple sifts
- A sift can be linked to multiple folders
- When a new document is uploaded to a folder, it is **automatically enqueued** for processing by every linked sift

## Document Processing Status

Each `(document_id, sift_id)` pair has a `DocumentSiftStatus` record:
- `pending` → queued, not yet started
- `processing` → worker currently running
- `done` → sift completed, `sift_record_id` points to the result
- `error` → sift failed, `error_message` contains reason

## Background Processing Queue

- An asyncio queue runs inside the server process
- `SIFTER_MAX_WORKERS` (default: 4) concurrent workers process documents
- Each worker takes a `(document_id, sift_id)` task, reads the file, runs the sift agent, saves the result, and updates the status record
- On document upload, one status record per linked sift is created with `status=pending`, then all are enqueued

## Storage Backend

- Default: `filesystem` — files stored at `{SIFTER_STORAGE_PATH}/{org_id}/{folder_id}/{filename}`
- Config key: `SIFTER_STORAGE_BACKEND` (`filesystem`)
- Config key: `SIFTER_STORAGE_PATH` (default: `./uploads`)

## User Flow

1. User creates a folder (name, description)
2. User links one or more sifts to the folder
3. User uploads documents via the folder browser (drag-and-drop modal or file picker)
4. Documents are automatically processed by all linked sifts
5. User monitors per-document, per-sift status badges inline in the document list
6. User navigates to document detail to see results per sift, re-trigger processing

## Frontend Pages

- **Folder Browser** (`/folders` and `/folders/:id`) — unified two-column layout:
  - *Left panel*: folder list (All Documents + one item per folder with doc count); "New Folder" button at bottom
  - *Right panel toolbar*: page title, Upload button (opens modal), New Folder button, search input
  - *Folder rows* (All Documents view): folder icon, name, doc count, date — click to filter
  - *Document rows* (folder selected): filename, size, date, per-sift status badges, Chat button, More menu (Open → `/documents/:id`, Reprocess)
  - *Linked Sifts section*: above document list when a folder is selected — shows linked sifts + Link/Unlink controls
  - *Upload modal*: drag-and-drop area, folder selector, file list with size, confirm button
- **Document Detail** (`/documents/:id`)
  - Metadata: filename, size, content type, uploaded by/at
  - Per-sift results: status badge, completed timestamp, error message if any, Reprocess button
