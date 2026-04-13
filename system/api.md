---
title: REST API Endpoints
status: synced
---

# REST API Endpoints

Base path: `/api`

**Auth requirement:** All endpoints except `/api/auth/register`, `/api/auth/login`, and `/health` require authentication via `Authorization: Bearer <jwt>` or `X-API-Key: sk-...` header. All resource queries are automatically filtered by the caller's `organization_id`.

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user; returns JWT + user info |
| POST | `/api/auth/login` | Login; returns JWT + user info |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/auth/switch-org` | Switch active org; returns new JWT |

Register/Login body: `{ "email", "password", "full_name"? }`
JWT response: `{ "access_token": str, "token_type": "bearer", "user": {...} }`

## API Keys

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/keys` | List API keys for current org (prefix + metadata, no hashes) |
| POST | `/api/keys` | Create API key; returns full key **once** |
| DELETE | `/api/keys/{key_id}` | Revoke API key |

Create body: `{ "name": str }`
Create response: `{ "key": {...metadata}, "plaintext": "sk-..." }`

## Organizations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orgs` | List user's organizations |
| POST | `/api/orgs` | Create organization |
| GET | `/api/orgs/{org_id}/members` | List members |
| POST | `/api/orgs/{org_id}/members` | Invite member by email |

## Extractions (Sifts)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/extractions` | Create new extraction |
| GET | `/api/extractions` | List extractions (scoped to org) |
| GET | `/api/extractions/{id}` | Get extraction details |
| PATCH | `/api/extractions/{id}` | Update extraction (name, description, instructions, schema) |
| DELETE | `/api/extractions/{id}` | Delete extraction + results |
| POST | `/api/extractions/{id}/upload` | Upload documents directly |
| POST | `/api/extractions/{id}/reindex` | Reindex all documents |
| POST | `/api/extractions/{id}/reset` | Reset error state |
| GET | `/api/extractions/{id}/records` | Get extracted records |
| GET | `/api/extractions/{id}/records/csv` | Export as CSV |
| POST | `/api/extractions/{id}/query` | Live NL query (one-off, not saved) |
| POST | `/api/extractions/{id}/chat` | Scoped Q&A chat (schema-aware) |

Chat body/response: `{ "message": str, "history"?: list }` → `{ "response": str, "data"?: list, "pipeline"?: list }`

## Aggregations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/aggregations` | Create saved aggregation (returns immediately, `status: generating`) |
| GET | `/api/aggregations` | List aggregations (optional `?extraction_id=`) |
| GET | `/api/aggregations/{id}` | Get aggregation detail |
| GET | `/api/aggregations/{id}/result` | Execute pipeline and return results |
| POST | `/api/aggregations/{id}/regenerate` | Re-generate pipeline from NL query |
| DELETE | `/api/aggregations/{id}` | Delete aggregation |

Result response: `{ "results": list, "pipeline": list, "ran_at": str }`

## Folders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/folders` | List folders for current org |
| POST | `/api/folders` | Create folder |
| GET | `/api/folders/{folder_id}` | Folder detail |
| PATCH | `/api/folders/{folder_id}` | Update folder (name, description) |
| DELETE | `/api/folders/{folder_id}` | Delete folder and all documents |
| GET | `/api/folders/{folder_id}/extractors` | List linked extractors |
| POST | `/api/folders/{folder_id}/extractors` | Link extractor: `{ "extraction_id": str }` |
| DELETE | `/api/folders/{folder_id}/extractors/{extraction_id}` | Unlink extractor |
| GET | `/api/folders/{folder_id}/documents` | List documents with per-extractor status |
| POST | `/api/folders/{folder_id}/documents` | Upload document (multipart); triggers processing |

## Webhooks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/webhooks` | List webhooks for current org |
| POST | `/api/webhooks` | Register webhook |
| DELETE | `/api/webhooks/{hook_id}` | Delete webhook |

Register body: `{ "events": list[str], "url": str, "sift_id"?: str }`
Events support wildcard patterns: `sift.*`, `**`, etc.
Delivery: HTTP POST to `url` with body `{ "event": str, "payload": {...} }`

## Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents/{document_id}` | Document detail |
| DELETE | `/api/documents/{document_id}` | Delete document + all extraction results |
| POST | `/api/documents/{document_id}/reprocess` | Re-trigger extraction; optional `{ "extraction_id": str }` in body |

## Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Global chat (optional `extraction_id`) |

Chat body: `{ "message": str, "extraction_id"?: str, "history"?: list }`
Chat response: `{ "response": str, "data"?: list, "pipeline"?: list }`

## Health

`GET /health` — returns `{ "status": "ok" }` (no auth required)
