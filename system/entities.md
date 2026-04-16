---
title: Domain Models
status: synced
---

# Domain Models

> **Scope:** OSS single-tenant models. Organization/multi-tenancy models live in `sifter-cloud` — see `system/cloud.md`.

## User

MongoDB collection: `users`

Unique index on `email`. Unique sparse index on `google_id` (partial, non-null only).

```python
{
    "_id": ObjectId,
    "email": str,                # unique, stored lowercase
    "hashed_password": str | None,  # bcrypt hash; None for Google-only users
    "full_name": str,
    "google_id": str | None,     # Google "sub" claim; set for Google-authenticated users
    "auth_provider": str,        # "email" (default) or "google"
    "created_at": datetime
}
```

Account linking: when a Google user logs in and no user with that `google_id` exists, the system looks up by `email`. If found, the existing user is linked (sets `google_id` and `auth_provider`). Otherwise a new user is created.

## APIKey

MongoDB collection: `api_keys`

Unique sparse index on `key_hash`. Index on `is_active`.

```python
{
    "_id": ObjectId,
    "name": str,
    "key_hash": str,             # SHA-256(key_without_sk_prefix) as hex
    "key_prefix": str,           # first 12 chars of full key, for display
    "created_at": datetime,
    "last_used_at": datetime | None,
    "is_active": bool
}
```

API key format: `sk-<secrets.token_urlsafe(36)>` (total ~50 chars). Full key shown once at creation, never stored.

## Sift

MongoDB collection: `sifts`

```python
{
    "_id": ObjectId,
    "name": str,
    "description": str,
    "instructions": str,
    "schema": str | None,        # optional JSON schema hint
    "status": "active" | "indexing" | "paused" | "error",
    "error": str | None,
    "processed_documents": int,
    "total_documents": int,
    "created_at": datetime,
    "updated_at": datetime
}
```

## SiftResult

MongoDB collection: `sift_results`

Compound index on `(sift_id, document_id)`.

```python
{
    "_id": ObjectId,
    "sift_id": str,
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
    "name": str,
    "description": str,
    "sift_id": str,
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
    "folder_id": str,
    "filename": str,             # unique within folder
    "original_filename": str,
    "content_type": str,
    "size_bytes": int,
    "uploaded_at": datetime,
    "storage_path": str          # filesystem path, S3 key, or GCS blob path
}
```

## FolderExtractor

MongoDB collection: `folder_extractors`

Compound index on `(folder_id, sift_id)`.

```python
{
    "_id": ObjectId,
    "folder_id": str,
    "sift_id": str,
    "created_at": datetime
}
```

## DocumentSiftStatus

MongoDB collection: `document_sift_statuses`

Compound index on `(document_id, sift_id)`.

```python
{
    "_id": ObjectId,
    "document_id": str,
    "sift_id": str,
    "status": "pending" | "processing" | "done" | "error",
    "started_at": datetime | None,
    "completed_at": datetime | None,
    "error_message": str | None,
    "sift_record_id": str | None   # SiftResult._id when done
}
```

## ProcessingTask

MongoDB collection: `processing_queue`

Compound index on `(status, created_at)`. Index on `document_id`.

```python
{
    "_id": ObjectId,
    "document_id": str,
    "sift_id": str,
    "storage_path": str,
    "status": "pending" | "processing" | "done" | "error",
    "attempts": int,             # incremented on each claim
    "max_attempts": int,         # default 3
    "error_message": str | None,
    "created_at": datetime,
    "claimed_at": datetime | None,
    "completed_at": datetime | None
}
```

## Webhook

MongoDB collection: `webhooks`

```python
{
    "_id": ObjectId,
    "events": list[str],           # wildcard patterns, e.g. ["sift.*"]
    "url": str,                    # delivery target
    "sift_id": str | None,         # optional filter: only fire for this sift
    "created_at": datetime
}
```

Wildcard rules: `*` matches any single segment, `**` matches any number of segments.
