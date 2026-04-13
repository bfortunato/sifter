---
title: Architecture & Tech Stack
status: draft
---

# Architecture & Tech Stack

## Backend

- **Language**: Python 3.11+
- **Framework**: FastAPI (async)
- **Database**: MongoDB via `motor` (async driver)
- **AI**: LiteLLM (multi-provider: OpenAI, Anthropic, Google, Ollama)
- **PDF processing**: pymupdf (fitz) for text extraction + page images
- **Logging**: structlog
- **Validation**: Pydantic v2
- **Settings**: pydantic-settings with `SIFTER_` env prefix
- **Package**: `pyproject.toml` (publishable as `sifter-ai` on PyPI)

## Frontend

- React 18 + Vite + TypeScript
- shadcn/ui + Tailwind CSS
- Lucide React (icons)
- TanStack React Query (server state, polling)
- React Router (routing)

## Deployment

- Docker Compose: `mongodb` + `api` + `frontend` services
- API exposed on port 8000, frontend on port 3000
- Uploads stored at `./uploads` (volume mounted)

## Project Layout

```
code/
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml
├── README.md
├── sifter/
│   ├── main.py
│   ├── config.py
│   ├── models/
│   ├── services/
│   ├── api/
│   ├── prompts/
│   └── sdk/
├── frontend/
│   └── src/
│       ├── api/
│       ├── hooks/
│       ├── pages/
│       └── components/
├── tests/
└── examples/
```
