---
title: Python SDK
status: draft
---

# Python SDK

A developer-facing Python package (`pip install sifter-ai`) for programmatic use of Sifter. Supports both server mode (wrapping the REST API) and direct mode (calling MongoDB and LLM directly without a running server).

## Usage Example

```python
from sifter import Sifter

s = Sifter(
    mongodb_uri="mongodb://localhost:27017",
    llm_model="openai/gpt-4o",
    llm_api_key="sk-..."
)

ext = s.create_extraction(
    name="December Invoices",
    instructions="Extract: client name, invoice date, total amount, VAT number"
)
ext.add_documents("./invoices/december/")
ext.wait()

results = ext.query("Total amount by client")
ext.export_csv("./output.csv")
```

## Modes

- **Server mode** (default): wraps REST API calls, requires a running Sifter server
- **Direct mode** (`mode="direct"`): calls MongoDB and LLM directly, no server needed

## Key Methods

- `Sifter.create_extraction(name, instructions, description?)` → `ExtractionHandle`
- `ExtractionHandle.add_documents(path)` — directory or file path(s)
- `ExtractionHandle.wait()` — block until indexing complete
- `ExtractionHandle.query(nl_query)` → list of dicts
- `ExtractionHandle.records()` → list of dicts
- `ExtractionHandle.export_csv(path)` — save CSV
