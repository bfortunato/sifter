---
title: Folders & Document Management
status: synced
---

# Folders & Document Management

Advanced document management replaces the flat extraction-upload model with a proper hierarchy:
**Organization → Folders → Documents → Extraction Results**

## Folders

A Folder is a named container for documents within an organization.
- Has a name and optional description
- Can be linked to one or more Extractors (Extractions)
- Documents uploaded to a folder are automatically processed by **all linked extractors**
- Tracks document count

## Documents

A Document represents an uploaded file stored in Sifter:
- Stored on the filesystem at `{storage_path}/{org_id}/{folder_id}/{filename}`
- Has metadata: filename, content type, size, upload timestamp, uploaded_by user
- Each `(document, extractor)` pair has an independent processing status

## Folder ↔ Extractor Links

The `FolderExtractor` link connects a folder to an extractor (many-to-many):
- A folder can be linked to multiple extractors
- An extractor can be linked to multiple folders
- When a new document is uploaded to a folder, it is **automatically enqueued** for processing by every linked extractor

## Document Processing Status

Each `(document_id, extraction_id)` pair has a `DocumentExtractionStatus` record:
- `pending` → queued, not yet started
- `processing` → worker currently running
- `done` → extraction completed, `extraction_record_id` points to the result
- `error` → extraction failed, `error_message` contains reason

## Background Processing Queue

- An asyncio queue runs inside the server process
- `SIFTER_MAX_WORKERS` (default: 4) concurrent workers process documents
- Each worker takes a `(document_id, extraction_id)` task, reads the file, runs the extraction agent, saves the result, and updates the status record
- On document upload, one status record per linked extractor is created with `status=pending`, then all are enqueued

## Storage Backend

- Default: `filesystem` — files stored at `{SIFTER_STORAGE_PATH}/{org_id}/{folder_id}/{filename}`
- Config key: `SIFTER_STORAGE_BACKEND` (`filesystem`)
- Config key: `SIFTER_STORAGE_PATH` (default: `./uploads`)

## User Flow

1. User creates a folder (name, description)
2. User links one or more extractors to the folder
3. User uploads documents to the folder (drag-and-drop or file picker)
4. Documents are automatically processed by all linked extractors
5. User monitors per-document, per-extractor status badges
6. User navigates to document detail to see results per extractor, re-trigger extraction

## Frontend Pages

- **Folders** (`/folders`) — list of folders with name, document count, extractor count, created date; "New Folder" button
- **Folder Detail** (`/folders/:id`)
  - Linked extractors section: current links + "Link Extractor" dropdown (select from existing extractors)
  - Upload section: drag-and-drop + file picker, shows upload progress
  - Document list: table with filename, size, upload date, per-extractor status badge for each linked extractor
- **Document Detail** (`/documents/:id`)
  - Metadata: filename, size, content type, uploaded by/at
  - Per-extractor tabs or accordion: status, extracted_data table, confidence score, "Reprocess" button
