"""
Sifter Python SDK

Usage (server mode — wraps REST API):
    from sifter import Sifter
    s = Sifter(api_url="http://localhost:8000")
    ext = s.create_extraction(name="Invoices", instructions="Extract: client, date, amount")
    ext.add_documents("./invoices/")
    ext.wait()
    print(ext.query("Total by client"))

Usage (direct mode — no server needed):
    from sifter import Sifter
    s = Sifter(
        mongodb_uri="mongodb://localhost:27017",
        llm_model="openai/gpt-4o",
        llm_api_key="sk-...",
        mode="direct"
    )
"""

import asyncio
import time
from pathlib import Path
from typing import Any, Optional


class ExtractionHandle:
    """Handle to an extraction. Provides sync convenience methods."""

    def __init__(self, extraction_id: str, client: "Sifter"):
        self.id = extraction_id
        self._client = client

    def add_documents(self, path: str | Path) -> "ExtractionHandle":
        """Upload documents from a file or directory path."""
        asyncio.run(self._client._upload_documents_async(self.id, path))
        return self

    def wait(self, poll_interval: float = 2.0, timeout: float = 300.0) -> "ExtractionHandle":
        """Block until extraction is no longer indexing."""
        start = time.time()
        while True:
            status = self._client._get_extraction_status(self.id)
            if status not in ("indexing",):
                return self
            if time.time() - start > timeout:
                raise TimeoutError(f"Extraction did not complete within {timeout}s")
            time.sleep(poll_interval)

    def query(self, nl_query: str) -> list[dict[str, Any]]:
        """Run a natural language query against this extraction."""
        return asyncio.run(self._client._live_query_async(self.id, nl_query))

    def records(self) -> list[dict[str, Any]]:
        """Return all extracted records."""
        return asyncio.run(self._client._get_records_async(self.id))

    def export_csv(self, output_path: str | Path) -> None:
        """Export records to a CSV file."""
        asyncio.run(self._client._export_csv_async(self.id, output_path))


class Sifter:
    """
    Sifter SDK client.

    Args:
        api_url: URL of running Sifter server (server mode)
        mongodb_uri: MongoDB connection string (direct mode)
        llm_model: LiteLLM model string (direct mode)
        llm_api_key: Provider API key (direct mode)
        mode: "server" (default) or "direct"
    """

    def __init__(
        self,
        api_url: str = "http://localhost:8000",
        mongodb_uri: str = "mongodb://localhost:27017",
        llm_model: str = "openai/gpt-4o",
        llm_api_key: str = "",
        mode: str = "server",
    ):
        self.api_url = api_url.rstrip("/")
        self.mode = mode

        if mode == "direct":
            # Override config for direct use
            import os
            os.environ.setdefault("SIFTER_MONGODB_URI", mongodb_uri)
            os.environ.setdefault("SIFTER_LLM_MODEL", llm_model)
            if llm_api_key:
                os.environ.setdefault("SIFTER_LLM_API_KEY", llm_api_key)
            from ..config import config
            config.mongodb_uri = mongodb_uri
            config.llm_model = llm_model
            if llm_api_key:
                config.llm_api_key = llm_api_key

    def create_extraction(
        self,
        name: str,
        instructions: str,
        description: str = "",
        schema: Optional[str] = None,
    ) -> ExtractionHandle:
        """Create a new extraction and return a handle to it."""
        extraction_id = asyncio.run(
            self._create_extraction_async(name, instructions, description, schema)
        )
        return ExtractionHandle(extraction_id, self)

    def get_extraction(self, extraction_id: str) -> ExtractionHandle:
        """Get a handle to an existing extraction."""
        return ExtractionHandle(extraction_id, self)

    def list_extractions(self) -> list[dict[str, Any]]:
        """List all extractions."""
        return asyncio.run(self._list_extractions_async())

    # ---- Async internals ----

    async def _create_extraction_async(
        self, name: str, instructions: str, description: str, schema: Optional[str]
    ) -> str:
        if self.mode == "server":
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"{self.api_url}/api/extractions",
                    json={
                        "name": name,
                        "description": description,
                        "extraction_instructions": instructions,
                        "extraction_schema": schema,
                    },
                )
                r.raise_for_status()
                return r.json()["id"]
        else:
            from ..db import get_db
            from ..services.extraction_service import ExtractionService
            svc = ExtractionService(get_db())
            await svc.ensure_indexes()
            extraction = await svc.create(name, description, instructions, schema)
            return extraction.id

    async def _upload_documents_async(self, extraction_id: str, path: str | Path) -> None:
        p = Path(path)
        if p.is_dir():
            files = [f for f in p.iterdir() if f.is_file() and not f.name.startswith(".")]
        else:
            files = [p]

        if self.mode == "server":
            import httpx
            async with httpx.AsyncClient(timeout=300.0) as client:
                form_files = []
                for f in files:
                    form_files.append(("files", (f.name, open(f, "rb"), "application/octet-stream")))
                r = await client.post(
                    f"{self.api_url}/api/extractions/{extraction_id}/upload",
                    files=form_files,
                )
                r.raise_for_status()
        else:
            from ..db import get_db
            from ..services.extraction_service import ExtractionService
            svc = ExtractionService(get_db())
            await svc.process_documents(extraction_id, [str(f) for f in files])

    async def _live_query_async(self, extraction_id: str, query: str) -> list[dict[str, Any]]:
        if self.mode == "server":
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"{self.api_url}/api/extractions/{extraction_id}/query",
                    json={"query": query},
                )
                r.raise_for_status()
                return r.json()["results"]
        else:
            from ..db import get_db
            from ..services.aggregation_service import AggregationService
            svc = AggregationService(get_db())
            results, _ = await svc.live_query(extraction_id, query)
            return results

    async def _get_records_async(self, extraction_id: str) -> list[dict[str, Any]]:
        if self.mode == "server":
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{self.api_url}/api/extractions/{extraction_id}/records")
                r.raise_for_status()
                return r.json()
        else:
            from ..db import get_db
            from ..services.extraction_service import ExtractionService
            svc = ExtractionService(get_db())
            return await svc.get_records(extraction_id)

    async def _export_csv_async(self, extraction_id: str, output_path: str | Path) -> None:
        if self.mode == "server":
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{self.api_url}/api/extractions/{extraction_id}/records/csv"
                )
                r.raise_for_status()
                csv_content = r.text
        else:
            from ..db import get_db
            from ..services.extraction_results import ExtractionResultsService
            svc = ExtractionResultsService(get_db())
            csv_content = await svc.export_csv(extraction_id)

        Path(output_path).write_text(csv_content, encoding="utf-8")

    async def _list_extractions_async(self) -> list[dict[str, Any]]:
        if self.mode == "server":
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{self.api_url}/api/extractions")
                r.raise_for_status()
                return r.json()
        else:
            from ..db import get_db
            from ..services.extraction_service import ExtractionService
            svc = ExtractionService(get_db())
            extractions = await svc.list_all()
            return [{"id": e.id, "name": e.name, "status": e.status} for e in extractions]

    def _get_extraction_status(self, extraction_id: str) -> str:
        if self.mode == "server":
            import httpx
            r = httpx.get(f"{self.api_url}/api/extractions/{extraction_id}")
            r.raise_for_status()
            return r.json()["status"]
        else:
            async def _get():
                from ..db import get_db
                from ..services.extraction_service import ExtractionService
                svc = ExtractionService(get_db())
                e = await svc.get(extraction_id)
                return e.status if e else "error"
            return asyncio.run(_get())
