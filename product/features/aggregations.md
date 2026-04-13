---
title: Aggregations & Named Queries
status: synced
---

# Aggregations & Named Queries

Named aggregations are saved queries tied to an extraction. They auto-generate a MongoDB aggregation pipeline from a natural language query and can be re-executed at any time.

## Named Aggregations

- A named aggregation has a name, NL query, and a generated MongoDB pipeline stored in the database
- On creation, the pipeline is generated **asynchronously** — the HTTP response returns immediately with `status: generating`
- The frontend polls `GET /api/aggregations/{id}` (every 2 seconds) until `status` becomes `ready` or `error`
- Once ready, the stored pipeline is executed on demand via `GET /api/aggregations/{id}/result`
- Results are computed fresh on each call (not cached); the pipeline itself is cached
- If the extraction schema changes, the pipeline can be regenerated via `POST /api/aggregations/{id}/regenerate`

## Aggregation Statuses

- `generating` — pipeline is being created by the LLM agent
- `ready` — pipeline is stored and can be executed
- `error` — pipeline generation failed (`error_message` contains reason)

## Live Query

`POST /api/extractions/{id}/query` — one-shot NL query, generates pipeline on-the-fly, runs it, returns results. Not saved. Useful for ad-hoc exploration.

## Result Shape

`GET /api/aggregations/{id}/result` returns:
```json
{
  "results": [...],
  "pipeline": [...],
  "ran_at": "2024-01-01T12:00:00Z"
}
```

## Frontend — Aggregation Panel

On the Extraction Detail page, the "Query" tab becomes a full aggregation management panel:

**Top section — Named Aggregations list:**
- Each row: name, status badge (spinner for generating, checkmark for ready, error badge), last ran timestamp, "Run" / "Regenerate" / "Delete" buttons
- "New Aggregation" button → dialog with name + NL query input
- While any aggregation has `status=generating`, poll every 2 seconds

**Bottom section — Ad-hoc Query:**
- The existing live query textarea + run button
- Results table below
- Collapsible "View pipeline" section showing generated pipeline JSON
