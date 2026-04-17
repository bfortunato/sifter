---
title: MCP Server
status: synced
---

# MCP Server (`sifter-mcp`)

## Overview

`sifter-mcp` is a standalone Python package that exposes Sifter's read access to AI agents and tools (Claude Desktop, Cursor, custom MCP clients) via the Model Context Protocol.

It wraps the `sifter-ai` Python SDK — no direct HTTP calls, no business logic duplication.

---

## Package

| Property | Value |
|----------|-------|
| Package name | `sifter-mcp` |
| Location | `code/mcp/` |
| Dependencies | `mcp`, `sifter-ai` |
| Entry point | `python -m sifter_mcp` |
| PyPI install | `pip install sifter-mcp` |
| Zero-install | `uvx sifter-mcp` |

---

## Configuration

All configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SIFTER_API_KEY` | *(required)* | API key for authentication |
| `SIFTER_BASE_URL` | `http://localhost:8000` | Sifter server base URL |

For cloud: set `SIFTER_BASE_URL=https://api.sifter.ai`.

---

## Transport

**v1** supports two transports:

| Transport | When | Config |
|-----------|------|--------|
| `stdio` | `uvx sifter-mcp` — local process (Claude Desktop, Cursor) | `SIFTER_API_KEY` + `--base-url` |
| `streamable-http` | Mounted in FastAPI server at `/mcp` — zero install for cloud users | `Authorization: Bearer <key>` |

The HTTP endpoint is mounted automatically when `sifter-mcp` is installed alongside `sifter-server`.

**v2 (future)**: Write operations, SSE transport for broader client support.

---

## Tools (v1 — read-only)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `list_sifts` | — | Array of sifts (id, name, instructions, document_count, record_count) |
| `get_sift` | `sift_id: str` | Sift metadata + inferred JSON schema |
| `list_records` | `sift_id: str`, `limit: int = 20`, `offset: int = 0` | Extracted records with `extracted_data` |
| `query_sift` | `sift_id: str`, `natural_language: str` | Query result (records + natural language answer) |
| `list_folders` | — | Array of folders (id, name, document_count) |
| `get_folder` | `folder_id: str` | Folder metadata + linked sifts + documents |

---

## Resources (v1 — optional)

| URI | Returns |
|-----|---------|
| `sift://{sift_id}/records` | All records for the sift as a JSON resource |

---

## Claude Desktop Configuration

### HTTP (Sifter Cloud — zero install)

```json
{
  "mcpServers": {
    "sifter": {
      "type": "http",
      "url": "https://api.sifter.ai/mcp",
      "headers": {
        "Authorization": "Bearer sk-your-key"
      }
    }
  }
}
```

### stdio (uvx — self-hosted or local)

```json
{
  "mcpServers": {
    "sifter": {
      "command": "uvx",
      "args": ["sifter-mcp", "--base-url", "http://localhost:8000"],
      "env": {
        "SIFTER_API_KEY": "sk-dev"
      }
    }
  }
}
```

---

## Implementation Notes

- Use **FastMCP** pattern from the `mcp` Python SDK
- Each tool function calls the corresponding method on the `Sifter` SDK client:
  - `list_sifts` → `Sifter.list_sifts()`
  - `get_sift` → `Sifter.get_sift(sift_id)`
  - `list_records` → `SiftHandle.records(limit, offset)`
  - `query_sift` → `SiftHandle.query(natural_language)`
  - `list_folders` → `Sifter.list_folders()`
  - `get_folder` → `Sifter.get_folder(folder_id)`
- The `Sifter` client is initialized once at startup from env vars
- Errors from the SDK bubble up as MCP error responses

---

## v2 (Future)

- Write tools: `create_sift`, `update_sift`, `upload_document`
- SSE transport
- Prompt templates: "summarize sift {id}" 
