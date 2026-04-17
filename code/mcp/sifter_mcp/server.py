"""
MCP server for Sifter (v1, read-only).

Two modes:
  stdio  — run via `uvx sifter-mcp` (Claude Desktop, Cursor)
  http   — mounted inside the Sifter FastAPI server at /mcp (cloud hosted)

Configuration:
  SIFTER_API_KEY  — API key (required for stdio mode; extracted from Bearer token in HTTP mode)
  SIFTER_BASE_URL — Sifter server URL (default http://localhost:8000)
"""

import contextvars
import os

from mcp.server.fastmcp import FastMCP
from sifter import Sifter

# Env-level defaults (used in stdio mode)
_api_url = os.environ.get("SIFTER_BASE_URL", "http://localhost:8000")
_env_api_key = os.environ.get("SIFTER_API_KEY", "")

# Per-request API key (set by Bearer auth middleware in HTTP mode)
_request_api_key: contextvars.ContextVar[str] = contextvars.ContextVar(
    "sifter_request_api_key", default=""
)

mcp = FastMCP("sifter")


def _get_client() -> Sifter:
    api_key = _request_api_key.get() or _env_api_key
    if not api_key:
        raise RuntimeError("SIFTER_API_KEY environment variable is required")
    return Sifter(api_url=_api_url, api_key=api_key)


@mcp.tool()
def list_sifts() -> list[dict]:
    """List all sifts with their name, instructions, and document/record counts."""
    return _get_client().list_sifts()


@mcp.tool()
def get_sift(sift_id: str) -> dict:
    """Get sift metadata and inferred extraction schema for a specific sift."""
    handle = _get_client().get_sift(sift_id)
    return handle._data if hasattr(handle, "_data") else {"sift_id": sift_id}


@mcp.tool()
def list_records(sift_id: str, limit: int = 20, offset: int = 0) -> list[dict]:
    """Get extracted records from a sift.

    Args:
        sift_id: The sift identifier
        limit: Maximum number of records to return (default 20, max 100)
        offset: Number of records to skip for pagination
    """
    limit = min(limit, 100)
    return _get_client().get_sift(sift_id).records(limit=limit, offset=offset)


@mcp.tool()
def query_sift(sift_id: str, natural_language: str) -> list[dict]:
    """Run a natural language query over a sift's extracted records.

    Args:
        sift_id: The sift identifier
        natural_language: The question to answer (e.g. "What is the total by client?")
    """
    return _get_client().get_sift(sift_id).query(natural_language)


@mcp.tool()
def list_folders() -> list[dict]:
    """List all folders with their name and document count."""
    return _get_client().list_folders()


@mcp.tool()
def get_folder(folder_id: str) -> dict:
    """Get folder metadata, linked sifts, and document list for a specific folder."""
    handle = _get_client().get_folder(folder_id)
    return {
        "documents": handle.documents(),
        "sifts": handle.sifts(),
    }


@mcp.resource("sift://{sift_id}/records")
def sift_records_resource(sift_id: str) -> str:
    """All extracted records for a sift as a JSON resource."""
    import json
    records = _get_client().get_sift(sift_id).records()
    return json.dumps(records, default=str, indent=2)
