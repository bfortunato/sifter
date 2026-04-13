---
title: Python SDK
status: synced
---

# Python SDK

A developer-facing Python package (`pip install sifter-ai`) for programmatic use of Sifter. Supports both server mode (wrapping the REST API) and direct mode (calling MongoDB and LLM directly without a running server).

## API Key Usage

The recommended way to use the SDK against a running Sifter server is with an API key:

```python
from sifter import Sifter

# Server mode with API key (recommended)
s = Sifter(
    api_url="https://my-sifter.example.com",
    api_key="sk-..."  # Create in Sifter Settings → API Keys
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

## Creating an API Key

1. Log in to Sifter
2. Go to Settings → API Keys
3. Click "Create Key", enter a name
4. Copy the full key — it is shown **once only**
5. Pass it as `api_key=` to the Sifter constructor or set `SIFTER_API_KEY` env var

## Direct Mode (No Server)

```python
s = Sifter(
    mongodb_uri="mongodb://localhost:27017",
    llm_model="openai/gpt-4o",
    llm_api_key="sk-openai-...",
    mode="direct"
)
```

## Modes

- **Server mode** (default): wraps REST API calls with `X-API-Key` header; requires a running Sifter server
- **Direct mode** (`mode="direct"`): calls MongoDB and LLM directly, no server needed

## Key Methods

- `Sifter.create_extraction(name, instructions, description?)` → `ExtractionHandle`
- `ExtractionHandle.add_documents(path)` — directory or file path(s)
- `ExtractionHandle.wait()` — block until indexing complete
- `ExtractionHandle.query(nl_query)` → list of dicts
- `ExtractionHandle.records()` → list of dicts
- `ExtractionHandle.export_csv(path)` — save CSV
