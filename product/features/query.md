---
title: Natural Language Query & Aggregation
status: synced
---

# Natural Language Query & Aggregation

Once documents are extracted, users can query the structured data using natural language. Queries are converted into MongoDB aggregation pipelines and executed against the extraction results.

## User Flow

1. User types a natural language query on the extraction detail page (e.g. "Total amount by client", "Show invoices from December sorted by date")
2. Sifter generates a MongoDB aggregation pipeline from the query using a pipeline agent
3. Pipeline is executed against the `extraction_results` collection filtered by both `extraction_id` and `organization_id`
4. Results are displayed as a table

## Saved Aggregations

Users can save frequently-used queries as named aggregations (see `aggregations.md`):
- Create a saved aggregation with name, query text
- System generates and stores the MongoDB pipeline **asynchronously** (status: generating → ready/error)
- Retrieve and re-execute at any time
- Results always reflect current data
- Regenerate pipeline if schema changes

## Key Behaviors

- Pipeline generation uses a cheaper/faster LLM model
- Field references use `$extracted_data.<fieldName>` format
- The `extraction_id` and `organization_id` filters are always injected automatically
- Case-insensitive regex for text matching
- Supported stages: `$group`, `$sort`, `$project`, `$match`, `$unwind`, `$limit`, `$skip`, `$count`
- Auth required: JWT Bearer or `X-API-Key`. Results scoped to caller's organization.
