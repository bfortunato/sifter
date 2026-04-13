# ⬡ Sifter

**Turn your documents into a queryable database.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/docker-compose-ready-blue.svg)](docker-compose.yml)

Sifter is an open-source AI-powered document extraction engine. Upload PDFs, images, and scanned documents — tell it what to extract in plain English — get a structured, queryable database back.

---

## 30-Second Demo

**Before:** 50 invoices in a folder, no way to query them.

**After:**

```python
from sifter import Sifter

s = Sifter(mongodb_uri="mongodb://localhost:27017", llm_api_key="sk-...")

ext = s.create_extraction(
    name="December Invoices",
    instructions="Extract: client name, invoice date, total amount, VAT number"
)
ext.add_documents("./invoices/december/")
ext.wait()

# Natural language → structured query
results = ext.query("Total amount invoiced by client, sorted descending")
# [{"_id": "Acme Corp", "total": 15400.0}, {"_id": "Globex", "total": 9200.0}, ...]

ext.export_csv("./december_summary.csv")
```

---

## Features

- **AI-powered extraction** — describe what to extract in natural language, no schema design required
- **Auto schema inference** — schema is inferred automatically from the first document
- **Natural language queries** — "Total amount by client" → MongoDB aggregation pipeline, executed instantly
- **Multi-provider LLM support** — OpenAI, Anthropic, Google, or local models via Ollama (powered by LiteLLM)
- **REST API** — full CRUD API for integration with any system
- **Python SDK** — `pip install sifter-ai` for programmatic use
- **Admin UI** — React web interface with records table, query panel, and chat
- **Self-hostable** — `docker compose up` and you're running
- **Vision-capable** — processes PDFs, PNG, JPG, TIFF with OCR via vision LLMs

---

## Quick Start

### Option A: Docker Compose (full stack)

```bash
git clone https://github.com/sifter-ai/sifter
cd sifter/code

cp .env.example .env
# Edit .env: set SIFTER_LLM_API_KEY

docker compose up
```

- **API**: http://localhost:8000 (docs at `/docs`)
- **UI**: http://localhost:3000

### Option B: SDK only

```bash
# Install uv first: https://docs.astral.sh/uv/getting-started/installation/
uv add sifter-ai

# Requires MongoDB running locally
# docker run -d -p 27017:27017 mongo:7
```

### Option C: Local development

[uv](https://docs.astral.sh/uv/) is the required package manager for this project.

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Start MongoDB
docker run -d -p 27017:27017 mongo:7

# Install backend (creates .venv automatically)
cd code
uv sync --dev

# Set env vars
cp .env.example .env
# Edit .env: set SIFTER_LLM_API_KEY

# Run API
uv run python -m sifter.main

# In another terminal: run frontend
cd frontend
npm install
npm run dev
```

---

## Supported File Types

| Format | Extension | Notes |
|--------|-----------|-------|
| PDF | `.pdf` | Text extraction + page images for vision models |
| PNG | `.png` | Vision model processing |
| JPEG | `.jpg`, `.jpeg` | Vision model processing |
| TIFF | `.tiff`, `.tif` | Vision model processing |

---

## Configuration

All configuration via environment variables with `SIFTER_` prefix:

| Variable | Default | Description |
|----------|---------|-------------|
| `SIFTER_LLM_API_KEY` | — | **Required.** Provider API key |
| `SIFTER_LLM_MODEL` | `openai/gpt-4o` | Extraction model (must be vision-capable) |
| `SIFTER_PIPELINE_MODEL` | `openai/gpt-4o-mini` | Query generation model (cheaper) |
| `SIFTER_MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `SIFTER_MONGODB_DATABASE` | `sifter` | Database name |
| `SIFTER_UPLOAD_DIR` | `./uploads` | Local file storage |
| `SIFTER_MAX_FILE_SIZE_MB` | `50` | Max upload file size |
| `SIFTER_HOST` | `0.0.0.0` | API server host |
| `SIFTER_PORT` | `8000` | API server port |

### Using different LLM providers

```bash
# OpenAI
SIFTER_LLM_MODEL=openai/gpt-4o
SIFTER_LLM_API_KEY=sk-...

# Anthropic
SIFTER_LLM_MODEL=anthropic/claude-3-5-sonnet-20241022
SIFTER_LLM_API_KEY=sk-ant-...

# Google
SIFTER_LLM_MODEL=google/gemini-1.5-pro
SIFTER_LLM_API_KEY=...

# Local (Ollama)
SIFTER_LLM_MODEL=ollama/llava
SIFTER_LLM_API_KEY=unused
```

---

## API Reference

Full OpenAPI docs available at `http://localhost:8000/docs`.

### Key Endpoints

```
POST /api/extractions                    Create extraction
POST /api/extractions/{id}/upload        Upload documents
GET  /api/extractions/{id}/records       Get extracted records
POST /api/extractions/{id}/query         Natural language query
GET  /api/extractions/{id}/records/csv   Export as CSV
POST /api/chat                           Chat with your data
```

---

## SDK Reference

```python
from sifter import Sifter

# Initialize
s = Sifter(
    api_url="http://localhost:8000",   # server mode (default)
    # OR
    mongodb_uri="...",
    llm_model="openai/gpt-4o",
    llm_api_key="sk-...",
    mode="direct",                     # direct mode (no server)
)

# Create extraction
ext = s.create_extraction(name="...", instructions="Extract: ...")

# Upload documents (file or directory)
ext.add_documents("./documents/")

# Wait for processing
ext.wait(poll_interval=2.0, timeout=300.0)

# Query
results = ext.query("Total amount by supplier")

# Get raw records
records = ext.records()

# Export
ext.export_csv("./output.csv")
```

---

## Project Structure

```
sifter/
├── main.py              FastAPI app entry point
├── config.py            Configuration
├── models/              Domain models (Extraction, ExtractionResult, Aggregation)
├── services/
│   ├── extraction_agent.py    LLM extraction logic
│   ├── pipeline_agent.py      NL → MongoDB pipeline generation
│   ├── extraction_service.py  Extraction lifecycle
│   ├── extraction_results.py  MongoDB results storage
│   ├── aggregation_service.py Aggregation lifecycle
│   └── file_processor.py      PDF/image processing
├── api/                 FastAPI routers
├── prompts/             Agent system prompts (markdown)
└── sdk/                 Python SDK client
```

---

## Contributing

Contributions welcome! Please open an issue first for significant changes.

```bash
# Setup dev environment (uv required)
uv sync --dev

# Run tests
uv run pytest tests/

# The prompts in sifter/prompts/ are the "secret sauce" — improve them carefully
```

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
