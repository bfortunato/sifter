---
title: "Server: Named Aggregations"
status: synced
---

# Named Aggregations — Server

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/aggregations` | Create saved aggregation (returns immediately, `status: generating`) |
| GET | `/api/aggregations` | List aggregations (`?sift_id=&limit=50&offset=0`) |
| GET | `/api/aggregations/{id}` | Get aggregation detail |
| GET | `/api/aggregations/{id}/result` | Execute pipeline and return results |
| POST | `/api/aggregations/{id}/regenerate` | Re-generate pipeline from NL query |
| DELETE | `/api/aggregations/{id}` | Delete aggregation |

Create body: `{ "name": str, "query": str, "sift_id": str }`
Result response: `{ "results": list, "pipeline": list, "ran_at": str }`

## Async Pipeline Generation

- `POST /api/aggregations` returns immediately with `status: generating`
- `asyncio.create_task(_generate_and_store_pipeline(...))` runs the LLM call in background
- Client polls `GET /api/aggregations/{id}` (every 2 seconds) until `status` is `ready` or `error`

## Statuses

| Status | Meaning |
|--------|---------|
| `generating` | Pipeline is being created by the LLM agent |
| `ready` | Pipeline stored; can be executed |
| `error` | Pipeline generation failed (`error_message` contains reason) |

## Key Behaviors

- Results from `GET /api/aggregations/{id}/result` are always computed fresh (pipeline cached, not results)
- Pipeline generation uses `SIFTER_PIPELINE_MODEL` (cheaper/faster than extraction model)
- `sift_id` filter is always injected automatically — results scoped to that sift
- If extraction schema changes, use `POST /api/aggregations/{id}/regenerate` to rebuild pipeline
