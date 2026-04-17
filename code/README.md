# Sifter — monorepo

This directory contains all Sifter code packages.

| Package | Path | PyPI / npm |
|---------|------|------------|
| `sifter-server` | `server/` | Self-hostable FastAPI backend |
| `sifter-ai` | `sdk/` | Python SDK (`pip install sifter-ai`) |
| `sifter-mcp` | `mcp/` | MCP server (`pip install sifter-mcp`) |
| `frontend` | `frontend/` | React web UI (Vite + shadcn/ui) |

---

## Development

Requirements: [`uv`](https://docs.astral.sh/uv/), `npm`, `docker`

```bash
# Start full stack (MongoDB + backend + frontend)
./run.sh
```

- Backend: `http://localhost:8000` (OpenAPI at `/docs`)
- Frontend: `http://localhost:3000`

```bash
# Tests (requires MongoDB on localhost:27017)
cd server && uv run pytest

# Frontend type check
cd frontend && npx tsc --noEmit

# MCP server tests
cd mcp && uv run pytest
```

---

## Packages

### `sifter-server`

FastAPI backend. Handles extraction, sifts, folders, records, aggregations, webhooks, and auth. Mounts the MCP ASGI app at `/mcp` when `sifter-mcp` is installed.

```bash
cd server
uv sync --extra mcp
uv run sifter-server
```

### `sifter-ai` (Python SDK)

```bash
pip install sifter-ai
```

```python
from sifter import Sifter

s = Sifter(api_key="sk-...")
records = s.sift("./invoices/", "client, date, total amount")
```

### `sifter-mcp` (MCP server)

Exposes sifts and records to Claude Desktop, Cursor, and AI agents via the Model Context Protocol.

**stdio (self-hosted):**
```json
{
  "mcpServers": {
    "sifter": {
      "command": "uvx",
      "args": ["sifter-mcp", "--base-url", "http://localhost:8000"],
      "env": { "SIFTER_API_KEY": "sk-dev" }
    }
  }
}
```

**HTTP (cloud):**
```json
{
  "mcpServers": {
    "sifter": {
      "url": "https://api.sifter.ai/mcp",
      "headers": { "Authorization": "Bearer <your-api-key>" }
    }
  }
}
```

---

## License

Apache 2.0. Created by [Bruno Fortunato](https://github.com/bfortunato).
