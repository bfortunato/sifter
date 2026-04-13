---
title: Domain Models
status: draft
---

# Domain Models

## Extraction

MongoDB collection: `extractions`

```python
{
    "_id": ObjectId,
    "name": str,
    "description": str,
    "extraction_instructions": str,   # NL: "Extract client, date, amount..."
    "extraction_schema": str | None,  # Auto-inferred after first doc
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

Compound index on `(extraction_id, document_id)`.

```python
{
    "_id": ObjectId,
    "extraction_id": str,
    "document_id": str,              # filename or unique ID
    "document_type": str,            # AI-detected: "invoice", "contract", etc.
    "confidence": float,             # 0.0 - 1.0
    "extracted_data": dict,          # Dynamic key-value pairs
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
    "extraction_id": str,
    "aggregation_query": str,         # NL query
    "aggregation_pipeline": str | None,  # Generated MongoDB pipeline JSON
    "aggregation_error": str | None,
    "status": "active" | "generating" | "error",
    "created_at": datetime,
    "updated_at": datetime
}
```
