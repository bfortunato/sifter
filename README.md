# Sifter

**Turn documents into structured data — instantly.**

Upload PDFs and images. Define what to extract in plain English. Query results with SQL or natural language. Self-hostable, open-source, Apache 2.0.

---

## What it does

Sifter takes unstructured documents and turns them into a queryable database — without writing parsing code.

1. **Create a sift** — describe what to extract in plain English ("client name, invoice date, total amount")
2. **Upload documents** — PDFs, images, or scanned pages via the UI, REST API, or Python SDK
3. **Query results** — filter records, run aggregations, or ask questions in natural language

```python
from sifter import Sifter

s = Sifter(api_key="sk-...")
records = s.sift("./invoices/", "client, date, total amount")
# [{"client": "Acme Corp", "date": "2024-01-15", "total_amount": 1500.0}, ...]
```

---

## Features

- **Sifts** — extraction schemas defined in plain English; Sifter infers the JSON schema automatically from results
- **Folders** — organise documents and link them to multiple sifts; upload once, process everywhere
- **Aggregations** — save named MongoDB pipelines generated from natural language ("total by client per month")
- **Chat & Query** — ask questions about your data in natural language; get structured results and conversational answers
- **Webhooks** — fire HTTP callbacks on `sift.document.processed`, `sift.error`, and more; wildcard event patterns supported
- **Python SDK** — full async client with `SiftHandle`, `FolderHandle`, polling helpers, and event callbacks
- **REST API** — complete OpenAPI spec at `/docs`; authentication via JWT or API key
- **Storage backends** — local filesystem (default), S3-compatible, or Google Cloud Storage
- **Self-hostable** — single `docker compose up`; no external services required beyond MongoDB and an LLM API key

---

## Quick start

### Docker Compose

```bash
git clone https://github.com/sifter-ai/sifter
cd sifter/code
cp .env.example .env          # add SIFTER_LLM_API_KEY
docker compose up -d
```

Open `http://localhost:3000` — register, create a sift, upload documents.

### Local development

Requirements: `uv`, `npm`, `docker`

```bash
cd sifter/code
./run.sh
```

Backend on `http://localhost:8000` · Frontend on `http://localhost:3000`

### Python SDK

```bash
pip install sifter-ai
```

```python
from sifter import Sifter

s = Sifter(base_url="http://localhost:8000", api_key="sk-dev")

# Create a sift and process a folder
sift = s.create_sift(
    name="Invoices",
    instructions="Extract: client name, invoice date, line items, total amount",
)
folder = s.create_folder("Q1 Invoices")
folder.add_sift(sift.id)
folder.upload("./invoices/")

# Wait for processing and fetch results
sift.wait()
for record in sift.records():
    print(record["extracted_data"])

# Natural language query
result = sift.query("What is the total revenue by client?")
print(result)
```

---

## Configuration

All settings use the `SIFTER_` prefix.

| Variable | Default | Description |
|----------|---------|-------------|
| `SIFTER_LLM_API_KEY` | *(required)* | LLM provider API key (OpenAI, Anthropic, etc.) |
| `SIFTER_LLM_MODEL` | `openai/gpt-4o` | Model for extraction (any LiteLLM string) |
| `SIFTER_PIPELINE_MODEL` | `openai/gpt-4o-mini` | Faster model for aggregation pipelines |
| `SIFTER_MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `SIFTER_API_KEY` | `sk-dev` | Bootstrap API key — **change in production** |
| `SIFTER_REQUIRE_API_KEY` | `false` | Require auth on all requests |
| `SIFTER_JWT_SECRET` | `dev-secret-...` | JWT signing secret — **change in production** |
| `SIFTER_STORAGE_BACKEND` | `filesystem` | `filesystem` \| `s3` \| `gcs` |
| `SIFTER_STORAGE_PATH` | `./uploads` | Base path for filesystem storage |
| `SIFTER_MAX_WORKERS` | `4` | Concurrent document processing workers |

See [`system/deployment.md`](system/deployment.md) for the full list including S3/GCS variables.

---

## Architecture

```
┌─────────────────────────────────────┐
│  React frontend (Vite + shadcn/ui)  │
│  JWT auth · React Query polling     │
└────────────────┬────────────────────┘
                 │ REST API
┌────────────────▼────────────────────┐
│  FastAPI backend (Python 3.11+)     │
│  Motor (MongoDB) · LiteLLM · pymupdf│
│  Persistent processing queue        │
└────────────┬───────────────┬────────┘
             │               │
      ┌──────▼──────┐  ┌─────▼──────┐
      │   MongoDB   │  │  Storage   │
      │  (queue +   │  │  FS/S3/GCS │
      │   data)     │  └────────────┘
      └─────────────┘
```

- **Background workers** poll a MongoDB-backed queue (persistent, retries up to 3×, stale task recovery)
- **LiteLLM** abstracts provider selection — swap between OpenAI, Anthropic, Google, Ollama via config
- **Storage backends** are abstracted behind a `StorageBackend` protocol; S3/GCS files are downloaded to a temp file before extraction
- **Open-core**: OSS ships with `UsageLimiter` and `EmailSender` no-op interfaces; the private cloud layer overrides them via FastAPI `dependency_overrides`

---

## API

Full interactive docs at `http://localhost:8000/docs` (Swagger) or `/redoc`.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register and get JWT |
| `POST` | `/api/sifts` | Create a sift |
| `POST` | `/api/sifts/{id}/upload` | Upload documents directly |
| `GET` | `/api/sifts/{id}/records` | Fetch extracted records |
| `POST` | `/api/sifts/{id}/query` | One-off natural language query |
| `POST` | `/api/folders/{id}/documents` | Upload to a folder (triggers linked sifts) |
| `POST` | `/api/aggregations` | Create a saved aggregation |
| `GET` | `/health` | Health check |

Authentication: `Authorization: Bearer <jwt>` or `X-API-Key: sk-...`

---

## Development

```bash
cd code

# Run tests (requires MongoDB on localhost:27017)
uv run pytest

# Type check frontend
cd frontend && npx tsc --noEmit
```

Tests run against a real MongoDB instance (`sifter_test` database). No mocks for the database layer.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
