---
title: Document Extraction
status: draft
---

# Document Extraction

Users upload unstructured documents (PDFs, images) and provide natural language instructions describing what fields to extract. Sifter processes each document through an AI vision model and stores structured results in MongoDB.

## User Flow

1. User creates an extraction with a name, description, and natural language instructions (e.g. "Extract: client name, invoice date, total amount, VAT number")
2. User uploads one or more documents (PDF, PNG, JPG, TIFF)
3. Sifter processes each document asynchronously, calling an LLM to extract the requested fields
4. Extraction schema is auto-inferred from the first processed document
5. User can view extracted records as a structured table
6. User can upload additional documents at any time
7. User can reindex all documents (useful when instructions change)
8. User can export records as CSV

## Key Behaviors

- Each document produces one `ExtractionResult` record with `extracted_data` key-value pairs
- Fields not found in a document are set to `null`
- Numeric values stored as numbers, dates as ISO YYYY-MM-DD strings
- The extraction tracks status: `active`, `indexing`, `paused`, `error`
- Progress tracked via `processed_documents` / `total_documents` counters
- Schema inference: after first extraction, generate a schema string like "client (string), date (string), amount (number)"
