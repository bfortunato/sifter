# Core Concepts

## Sifts

A **Sift** is the core entity in Sifter. It defines:

- A **name** and optional description
- **Instructions** — plain English description of what to extract (e.g. `"Extract: client name, invoice date, total amount, VAT number"`)
- A **schema** — automatically inferred from the first processed document
- A persistent **database of results** (one record per document)

Sifts have a lifecycle status: `active`, `indexing`, `paused`, `error`.

A sift can receive documents in two ways:

- **Direct upload** via `POST /api/sifts/{id}/upload` or `sift.upload()`
- **Via Folders** — link a folder and all documents in it are automatically processed

## Folders

A **Folder** is a document container. It connects to one or more sifts (many-to-many):

- Upload a document once — every linked sift processes it automatically
- A sift can be linked to multiple folders
- Folders support renaming and per-document status tracking

## Documents

A **Document** is a file stored in Sifter. Each `(document, sift)` pair has an independent processing status:

| Status | Meaning |
|--------|---------|
| `pending` | Queued, not yet started |
| `processing` | Worker currently running |
| `done` | Extraction complete |
| `error` | Extraction failed |

## Aggregations

**Aggregations** are named, reusable MongoDB aggregation pipelines generated from natural language queries. They are attached to a sift and can be refreshed on demand.

## Events

Sifter emits events during processing:

| Event | When |
|-------|------|
| `sift.document.processed` | A document was extracted by a sift |
| `sift.completed` | All documents in a sift finished |
| `sift.error` | Extraction error on a document |
| `folder.document.uploaded` | New document added to a folder |

Events can be consumed via **SDK callbacks** (client-side polling during `wait()`) or **server-side webhooks**.
