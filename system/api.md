---
title: REST API Endpoints
status: synced
---

# REST API Endpoints

Base path: `/api`

**Auth:** All endpoints except `/api/auth/register`, `/api/auth/login`, and `/health` require `Authorization: Bearer <jwt>` or `X-API-Key: sk-...`. Sifter OSS is single-tenant — no org scoping. Multi-tenant org management is a cloud-only feature (see `system/cloud.md`).

**Anonymous access:** By default, requests without credentials are allowed (Principal = `anonymous`). Set `SIFTER_REQUIRE_API_KEY=true` to enforce auth on all endpoints.

## Rate Limits

Enforced via `slowapi`, keyed by client IP.

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/login` | 10 requests / minute |
| `POST /api/auth/register` | 5 requests / minute |
| `POST /api/folders/{id}/documents` | 30 requests / minute |
| `POST /api/sifts/{id}/upload` | 30 requests / minute |

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user; returns JWT + user info |
| POST | `/api/auth/login` | Login; returns JWT + user info |
| GET | `/api/auth/me` | Current user info (requires JWT or API key) |

Register/Login body: `{ "email", "password", "full_name"? }`
JWT response: `{ "access_token": str, "token_type": "bearer", "user": { id, email, full_name, created_at } }`

## API Keys

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/keys` | List active API keys (prefix + metadata, no hashes) |
| POST | `/api/keys` | Create API key; returns full key **once** |
| DELETE | `/api/keys/{key_id}` | Revoke API key |

Create body: `{ "name": str }`
Create response: `{ "key": {...metadata}, "plaintext": "sk-..." }`

## Sifts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sifts` | Create new sift |
| GET | `/api/sifts` | List sifts (`?limit=50&offset=0`) |
| GET | `/api/sifts/{id}` | Get sift details |
| PATCH | `/api/sifts/{id}` | Update sift (name, description, instructions, schema) |
| DELETE | `/api/sifts/{id}` | Delete sift + results |
| POST | `/api/sifts/{id}/upload` | Upload documents directly to sift |
| POST | `/api/sifts/{id}/reindex` | Reindex all documents |
| POST | `/api/sifts/{id}/reset` | Reset error state |
| GET | `/api/sifts/{id}/records` | Get extracted records (`?limit=100&offset=0`) |
| GET | `/api/sifts/{id}/records/csv` | Export records as CSV |
| POST | `/api/sifts/{id}/query` | Live NL query (one-off, not saved) |
| POST | `/api/sifts/{id}/chat` | Scoped Q&A chat (schema-aware) |

Chat body/response: `{ "message": str, "history"?: list }` → `{ "response": str, "data"?: list, "pipeline"?: list }`

List response envelope (all `GET` list endpoints):
```json
{ "items": [...], "total": 243, "limit": 50, "offset": 0 }
```

## Aggregations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/aggregations` | Create saved aggregation (returns immediately, `status: generating`) |
| GET | `/api/aggregations` | List aggregations (`?sift_id=&limit=50&offset=0`) |
| GET | `/api/aggregations/{id}` | Get aggregation detail |
| GET | `/api/aggregations/{id}/result` | Execute pipeline and return results |
| POST | `/api/aggregations/{id}/regenerate` | Re-generate pipeline from NL query |
| DELETE | `/api/aggregations/{id}` | Delete aggregation |

Result response: `{ "results": list, "pipeline": list, "ran_at": str }`

## Folders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/folders` | List folders (`?limit=50&offset=0`) |
| POST | `/api/folders` | Create folder |
| GET | `/api/folders/{folder_id}` | Folder detail + linked sifts |
| PATCH | `/api/folders/{folder_id}` | Update folder (name, description) |
| DELETE | `/api/folders/{folder_id}` | Delete folder and all documents |
| GET | `/api/folders/{folder_id}/extractors` | List linked sifts |
| POST | `/api/folders/{folder_id}/extractors` | Link sift: `{ "sift_id": str }` |
| DELETE | `/api/folders/{folder_id}/extractors/{sift_id}` | Unlink sift |
| GET | `/api/folders/{folder_id}/documents` | List documents with per-sift status (`?limit=100&offset=0`) |
| POST | `/api/folders/{folder_id}/documents` | Upload document (multipart); triggers processing |

## Webhooks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Register webhook |
| DELETE | `/api/webhooks/{hook_id}` | Delete webhook |

Register body: `{ "events": list[str], "url": str, "sift_id"?: str }`
Events support wildcard patterns: `sift.*`, `**`, etc.
Delivery: HTTP POST to `url` with body `{ "event": str, "payload": {...} }`

Event types: `sift.document.processed`, `sift.completed`, `sift.error`, `folder.document.uploaded`

## Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents/{document_id}` | Document detail + per-sift statuses |
| DELETE | `/api/documents/{document_id}` | Delete document + all extraction results |
| POST | `/api/documents/{document_id}/reprocess` | Re-trigger extraction; optional `{ "sift_id": str }` in body |

## Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Global chat (optional `sift_id`) |

Chat body: `{ "message": str, "sift_id"?: str, "history"?: list }`
Chat response: `{ "response": str, "data"?: list, "pipeline"?: list }`

## Config

`GET /api/config` — no auth required. Returns deployment-level configuration.

```json
{ "mode": "oss" }
```

In `sifter-cloud`, this is overridden to return `{ "mode": "cloud" }`. The frontend uses this to show/hide billing, team management, and org switching.

## Health

`GET /health` — no auth required.

Response:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "components": {
    "database": "ok",
    "queue": { "status": "ok", "pending": 3, "processing": 1 }
  }
}
```

Returns HTTP 503 if any component reports an error.
