---
title: "Server: Natural Language Query"
status: synced
---

# Natural Language Query — Server

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sifts/{id}/query` | Live NL query — one-off, not saved |

Body: `{ "query": str }`
Response: `{ "results": list, "pipeline": list }`

Auth required: JWT Bearer or `X-API-Key`.

## Pipeline Generation

1. Receives a natural language query (e.g. "Total amount by client", "Show invoices from December sorted by date")
2. Calls `pipeline_agent.py` with the query + sift schema
3. Agent generates a MongoDB aggregation pipeline using a lightweight LLM model (`SIFTER_PIPELINE_MODEL`)
4. Pipeline is executed against `sift_results` collection filtered by `sift_id`
5. Results are returned immediately — nothing is persisted

## Key Behaviors

- Field references use `$extracted_data.<fieldName>` format
- The `sift_id` filter is always injected automatically
- Case-insensitive regex for text matching
- Supported stages: `$group`, `$sort`, `$project`, `$match`, `$unwind`, `$limit`, `$skip`, `$count`
- Auth required — results scoped to the sift (which is already org-scoped)

## Saved Queries → Aggregations

For persistent queries, see `server/aggregations.md`. `POST /api/sifts/{id}/query` is for one-shot, ad-hoc exploration. Named aggregations store the pipeline and can be re-executed at any time.
