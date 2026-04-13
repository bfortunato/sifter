---
title: Architecture & Tech Stack
status: synced
---

# Architecture & Tech Stack

## Backend

- **Language**: Python 3.11+
- **Framework**: FastAPI (async)
- **Database**: MongoDB via `motor` (async driver)
- **AI**: LiteLLM (multi-provider: OpenAI, Anthropic, Google, Ollama)
- **PDF processing**: pymupdf (fitz) for text extraction + page images
- **Auth**: `python-jose` (JWT HS256) + `passlib[bcrypt]` (password hashing)
- **Logging**: structlog
- **Validation**: Pydantic v2
- **Settings**: pydantic-settings with `SIFTER_` env prefix
- **Package**: `pyproject.toml` (publishable as `sifter-ai` on PyPI)
- **SDK**: pure HTTP client (`httpx`) wrapping the REST API — no direct mode

## Frontend

- React 18 + Vite + TypeScript
- shadcn/ui + Tailwind CSS
- Lucide React (icons)
- TanStack React Query (server state, polling)
- React Router (routing)
- Auth via JWT stored in `localStorage`; injected via `apiFetch` utility

## Auth Middleware

A FastAPI dependency `get_current_principal()` is applied to all protected routes:
- Reads `Authorization: Bearer <jwt>` or `X-API-Key: sk-...` header
- For JWT: validates signature + expiry using `python-jose` HS256; extracts `user_id` + `org_id` from payload
- For API key: strips `sk-` prefix, computes SHA-256 hash, looks up `api_keys` collection, checks `is_active`, updates `last_used_at`
- Returns `Principal(user_id, org_id, via: "jwt"|"api_key")`
- Raises HTTP 401 on missing or invalid credentials

### JWT Configuration

- Algorithm: HS256
- Secret: `SIFTER_JWT_SECRET` env var (default: dev value, logs warning in production)
- Expiry: `SIFTER_JWT_EXPIRE_MINUTES` (default: 1440 = 24h)
- Payload: `{ "sub": user_id, "org_id": org_id, "exp": ..., "iat": ... }`
- Organization switching: `POST /api/auth/switch-org` issues a new token with a different `org_id`

### API Key Format

- Format: `sk-<secrets.token_urlsafe(36)>` (~50 chars total)
- Display prefix: first 12 chars (e.g. `sk-AbCdEfGhIjKl...`)
- Stored: `SHA-256(key_without_sk_prefix)` as hex string in `api_keys.key_hash`
- Full key shown once at creation, never stored

## Background Document Processing Queue

- Module-level `asyncio.Queue` in `sifter/services/document_processor.py`
- `SIFTER_MAX_WORKERS` (default: 4) worker coroutines started via `asyncio.create_task()` in the FastAPI lifespan
- Each worker: `task = await queue.get()` → set status=processing → run extraction → set status=done/error → `queue.task_done()`
- On document upload to a folder: one `DocumentExtractionStatus(pending)` per linked extractor created, then all enqueued
- On shutdown: drain queue gracefully in lifespan cleanup

## Event System

- Events are emitted by the server on document processing, sift completion, and errors.
- **SDK callbacks**: the `SiftHandle.on()` / `FolderHandle.on()` methods register Python callbacks. Wildcard matching (`*` single segment, `**` any segments) runs client-side during `wait()` polling.
- **Webhooks**: stored in a `webhooks` collection (`org_id`, `events` pattern list, `url`, optional `sift_id` filter). On each event the server fans out to all matching webhooks via background `httpx` POST calls.
- Event types: `sift.document.processed`, `sift.completed`, `sift.error`, `folder.document.uploaded`.
- Wildcard matching is evaluated server-side for webhooks using the same pattern rules.

## Async Aggregation Pipeline Generation

- `POST /api/aggregations` returns immediately with `status=generating`
- `asyncio.create_task(_generate_and_store_pipeline(...))` runs in background
- Frontend polls `GET /api/aggregations/{id}` every 2 seconds until `status` becomes `ready` or `error`
- Same pattern as extraction `status=indexing` polling

## Storage Backend

- Default: `filesystem`
- Config: `SIFTER_STORAGE_BACKEND=filesystem`, `SIFTER_STORAGE_PATH=./uploads`
- Files stored at `{storage_path}/{org_id}/{folder_id}/{filename}`
- `Document.storage_path` stores the full absolute path for filesystem mode

## Multi-Tenancy

- All MongoDB queries include `{"organization_id": principal.org_id}` filter
- Existing documents with no `organization_id` are invisible after migration (greenfield assumption)
- `ExtractionResultsService` always injects `organization_id` in aggregation pipelines alongside `extraction_id`

## Project Layout

```
code/
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml
├── README.md
├── sifter/
│   ├── main.py
│   ├── config.py
│   ├── auth.py               # Principal, get_current_principal, hash_password
│   ├── models/
│   │   ├── user.py           # User, Organization, OrganizationMember, APIKey
│   │   ├── document.py       # Folder, Document, FolderExtractor, DocumentExtractionStatus
│   │   ├── extraction.py
│   │   ├── extraction_result.py
│   │   └── aggregation.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── document_service.py
│   │   ├── document_processor.py   # asyncio queue + workers
│   │   ├── qa_agent.py
│   │   ├── extraction_service.py
│   │   ├── extraction_results.py
│   │   ├── aggregation_service.py
│   │   ├── extraction_agent.py
│   │   ├── pipeline_agent.py
│   │   └── file_processor.py
│   ├── api/
│   │   ├── auth.py
│   │   ├── keys.py
│   │   ├── orgs.py
│   │   ├── folders.py
│   │   ├── documents.py
│   │   ├── extractions.py
│   │   ├── aggregations.py
│   │   └── chat.py
│   ├── prompts/
│   │   ├── extraction.md
│   │   ├── aggregation_pipeline.md
│   │   ├── chat_agent.md
│   │   └── qa_agent.md
│   └── sdk/
├── frontend/
│   └── src/
│       ├── lib/
│       │   └── apiFetch.ts   # Auth-injecting fetch wrapper
│       ├── context/
│       │   └── AuthContext.tsx
│       ├── api/
│       ├── hooks/
│       ├── pages/
│       └── components/
├── tests/
└── examples/
```
