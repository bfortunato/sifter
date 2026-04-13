---
title: REST API Endpoints
status: draft
---

# REST API Endpoints

Base path: `/api`

## Extractions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/extractions` | Create new extraction |
| GET | `/api/extractions` | List all extractions |
| GET | `/api/extractions/{id}` | Get extraction details |
| DELETE | `/api/extractions/{id}` | Delete extraction + results |
| POST | `/api/extractions/{id}/upload` | Upload documents (multipart) |
| POST | `/api/extractions/{id}/reindex` | Reindex all documents |
| POST | `/api/extractions/{id}/reset` | Reset error state |
| GET | `/api/extractions/{id}/records` | Get extracted records |
| GET | `/api/extractions/{id}/records/csv` | Export as CSV |
| POST | `/api/extractions/{id}/query` | Live NL query (aggregation) |

## Aggregations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/aggregations` | Create saved aggregation |
| GET | `/api/aggregations` | List aggregations |
| GET | `/api/aggregations/{id}` | Get aggregation details |
| GET | `/api/aggregations/{id}/result` | Execute and return result |
| DELETE | `/api/aggregations/{id}` | Delete aggregation |

## Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send message, get response |

Chat body: `{ "message": str, "extraction_id"?: str, "history"?: list }`
Chat response: `{ "response": str, "data"?: list }`

## Health

`GET /health` — returns `{ "status": "ok" }`
