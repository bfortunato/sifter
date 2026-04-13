---
title: Domain Models
status: synced
---

# Domain Models

## User

MongoDB collection: `users`

Unique index on `email`.

```python
{
    "_id": ObjectId,
    "email": str,                # unique
    "password_hash": str,        # bcrypt hash
    "full_name": str,
    "created_at": datetime
}
```

## Organization

MongoDB collection: `organizations`

```python
{
    "_id": ObjectId,
    "name": str,
    "slug": str,                 # URL-safe, derived from email on registration
    "created_at": datetime
}
```

## OrganizationMember

MongoDB collection: `organization_members`

Compound index on `(org_id, user_id)`.

```python
{
    "_id": ObjectId,
    "org_id": str,
    "user_id": str,
    "role": "owner" | "admin" | "member",
    "joined_at": datetime
}
```

## APIKey

MongoDB collection: `api_keys`

Index on `key_hash`.

```python
{
    "_id": ObjectId,
    "name": str,
    "key_hash": str,             # SHA-256(key_without_sk_prefix) as hex
    "key_prefix": str,           # first 12 chars of full key, for display
    "organization_id": str,
    "created_by": str,           # user_id
    "created_at": datetime,
    "last_used_at": datetime | None,
    "is_active": bool
}
```

API key format: `sk-<secrets.token_urlsafe(36)>` (total ~50 chars). Full key shown once at creation, never stored.

## Extraction

MongoDB collection: `extractions`

```python
{
    "_id": ObjectId,
    "organization_id": str,      # tenant isolation
    "name": str,
    "description": str,
    "extraction_instructions": str,
    "extraction_schema": str | None,
    "status": "active" | "indexing" | "paused" | "error",
    "extraction_error": str | None,
    "processed_documents": int,
    "total_documents": int,
    "created_at": datetime,
    "updated_at": datetime
}
```

## ExtractionResult

MongoDB collection: `extraction_results`

Compound index on `(extraction_id, document_id)`. Index on `organization_id`.

```python
{
    "_id": ObjectId,
    "organization_id": str,
    "extraction_id": str,
    "document_id": str,
    "document_type": str,
    "confidence": float,
    "extracted_data": dict,
    "created_at": datetime
}
```

## Aggregation

MongoDB collection: `aggregations`

```python
{
    "_id": ObjectId,
    "organization_id": str,
    "name": str,
    "description": str,
    "extraction_id": str,
    "aggregation_query": str,
    "pipeline": list | None,         # Generated MongoDB pipeline (JSON array)
    "aggregation_error": str | None,
    "status": "generating" | "ready" | "error",
    "last_run_at": datetime | None,
    "created_at": datetime,
    "updated_at": datetime
}
```

## Folder

MongoDB collection: `folders`

```python
{
    "_id": ObjectId,
    "organization_id": str,
    "name": str,
    "description": str,
    "document_count": int,
    "created_at": datetime
}
```

## Document

MongoDB collection: `documents`

```python
{
    "_id": ObjectId,
    "organization_id": str,
    "folder_id": str,
    "filename": str,             # unique within folder
    "original_filename": str,
    "content_type": str,
    "size_bytes": int,
    "uploaded_by": str,          # user_id
    "uploaded_at": datetime,
    "storage_path": str          # filesystem path or GridFS id
}
```

## FolderExtractor

MongoDB collection: `folder_extractors`

Compound index on `(folder_id, extraction_id)`.

```python
{
    "_id": ObjectId,
    "organization_id": str,
    "folder_id": str,
    "extraction_id": str,
    "created_at": datetime
}
```

## DocumentExtractionStatus

MongoDB collection: `document_extraction_statuses`

Compound index on `(document_id, extraction_id)`. Index on `organization_id`.

```python
{
    "_id": ObjectId,
    "organization_id": str,
    "document_id": str,
    "extraction_id": str,
    "status": "pending" | "processing" | "done" | "error",
    "started_at": datetime | None,
    "completed_at": datetime | None,
    "error_message": str | None,
    "extraction_record_id": str | None   # ExtractionResult._id when done
}
```

## Webhook

MongoDB collection: `webhooks`

Index on `organization_id`.

```python
{
    "_id": ObjectId,
    "organization_id": str,
    "events": list[str],           # wildcard patterns, e.g. ["sift.*"]
    "url": str,                    # delivery target
    "sift_id": str | None,         # optional filter: only fire for this sift
    "created_at": datetime
}
```

Wildcard rules: `*` matches any single segment, `**` matches any number of segments.
