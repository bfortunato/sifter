---
title: Python SDK
status: synced
---

# Python SDK

A developer-facing Python package (`pip install sifter-ai`) for programmatic use of Sifter. The SDK is a pure HTTP client that always connects to a running Sifter server (local or remote). There is no direct mode.

> Start the server with `./run.sh` before using the SDK.

## Quick Start

```python
from sifter import Sifter

s = Sifter(api_key="sk-...")  # or api_url="http://localhost:8000"

# One-liner convenience
records = s.sift("./invoices/", "client, date, total")
```

## Constructor

```python
s = Sifter(
    api_url="http://localhost:8000",  # default
    api_key="",                       # or set SIFTER_API_KEY env var
)
```

- `api_key` can also be set via the `SIFTER_API_KEY` environment variable.
- Every request sends the `X-API-Key` header automatically.

## Sift CRUD

A **Sift** defines what to extract (instructions/schema) and owns a persistent database of extracted records. It can receive documents directly or via linked folders.

```python
sift = s.create_sift("Invoices", "client, date, total, VAT")
sift = s.get_sift("sift_id")
sifts = s.list_sifts()
sift.update(name="Invoices 2024", instructions="...")
sift.delete()
```

## Sift: Documents and Results

```python
sift.upload("./invoices/")    # directory or file path
sift.wait()                    # block until processing complete
records = sift.records()       # list of dicts
results = sift.query("Total by client")
sift.export_csv("output.csv")
```

## Folder CRUD

A **Folder** is a shared document container. When a document is added, modified, or deleted, all linked sifts are updated automatically. A folder can feed multiple sifts; a sift can be linked to multiple folders.

```python
folder = s.create_folder("Contracts 2024")
folder = s.get_folder("folder_id")
folders = s.list_folders()
folder.update(name="Contracts 2024-2025")
folder.delete()
```

## Folder: Documents and Sifts

```python
folder.upload("./contracts/")   # upload documents to folder
docs = folder.documents()        # list documents in folder
folder.add_sift(sift)            # link a sift — folder docs processed by it
folder.remove_sift(sift)
linked = folder.sifts()          # list linked sifts
```

## Multi-Sift on Same Folder

```python
parties = s.create_sift("Parties", "contracting parties, dates")
clauses = s.create_sift("Clauses", "non-compete, termination conditions")
folder.add_sift(parties)
folder.add_sift(clauses)
# → all folder docs processed by both sifts
```

## One-Liner Convenience

```python
records = s.sift("./invoices/", "client, date, total")
```

Creates a temporary sift, uploads the documents, waits for processing, and returns records.

## Event Callbacks (SDK)

Register local callbacks for events on a sift or folder. The SDK polls internally during `wait()`. No extra infrastructure needed.

`on()` accepts a single event name, a list of event names, or a wildcard pattern. Wildcards use `*` to match any segment.

```python
# Single event
sift.on("document.processed", lambda doc, record: print(record))

# Multiple events
sift.on(["document.processed", "error"], lambda doc, record: print(record))

# Wildcard — all events on this sift
sift.on("*", lambda doc, record: print(record))

# Wildcard — all document-level events
sift.on("document.*", lambda doc, record: print(record))

folder.on("document.uploaded", lambda doc: print(f"New: {doc.filename}"))
folder.on("*", lambda doc: print(f"Event on: {doc.filename}"))
```

## Server-Side Webhooks

Register a URL to receive HTTP POST requests when events occur. Useful for production integrations.

`events` accepts a single event name, a list, or a wildcard pattern.

```python
# Single event
s.register_hook(
    events="sift.document.processed",
    url="https://my-app.com/webhook",
    sift_id=sift.id,  # optional filter
)

# Multiple events
s.register_hook(
    events=["sift.document.processed", "sift.error"],
    url="https://my-app.com/webhook",
)

# Wildcard — all sift-level events
s.register_hook(
    events="sift.*",
    url="https://my-app.com/webhook",
)

# Wildcard — all events
s.register_hook(
    events="*",
    url="https://my-app.com/webhook",
)

hooks = s.list_hooks()
s.delete_hook(hook_id)
```

## Event Types

| Event | Description |
|---|---|
| `sift.document.processed` | A document was extracted by a sift |
| `sift.completed` | All documents in a sift finished processing |
| `sift.error` | Extraction error on a document |
| `folder.document.uploaded` | New document added to a folder |

## Wildcard Matching Rules

- `*` — matches any single segment (e.g. `sift.*` matches `sift.completed` but not `folder.document.uploaded`)
- `**` — matches any number of segments (e.g. `**` matches everything)
- Matching is evaluated server-side for webhooks, client-side for SDK callbacks

## Creating an API Key

1. Log in to Sifter
2. Go to Settings → API Keys
3. Click "Create Key", enter a name
4. Copy the full key — shown **once only**
5. Pass it as `api_key=` or set `SIFTER_API_KEY` env var
