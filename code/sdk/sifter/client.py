"""
Sifter Python SDK

The SDK always connects to a running Sifter server (local or remote).
Start the server with ./run.sh before using the SDK.

Usage:
    from sifter import Sifter

    s = Sifter(api_key="sk-...")

    # One-liner
    records = s.sift("./invoices/", "client, date, total")

    # Full API
    sift = s.create_sift("Invoices", "client, date, total, VAT")
    sift.upload("./invoices/")
    sift.wait()
    records = sift.records()
    sift.export_csv("output.csv")
"""

import fnmatch
import os
import time
from pathlib import Path
from typing import Any, Callable, Optional, Union


def _matches_pattern(pattern: str, event: str) -> bool:
    """
    Match an event name against a wildcard pattern.
    - '*'  matches any single segment (split by '.')
    - '**' matches any number of segments
    """
    if pattern == "**" or pattern == "*":
        return True
    p_parts = pattern.split(".")
    e_parts = event.split(".")
    # Build a glob-style string for fnmatch: replace ** with a placeholder
    # Simpler: recursive matching
    def _match(pp: list[str], ep: list[str]) -> bool:
        if not pp and not ep:
            return True
        if not pp:
            return False
        if pp[0] == "**":
            # ** matches zero or more segments
            for i in range(len(ep) + 1):
                if _match(pp[1:], ep[i:]):
                    return True
            return False
        if not ep:
            return False
        if pp[0] == "*" or pp[0] == ep[0]:
            return _match(pp[1:], ep[1:])
        return False
    return _match(p_parts, e_parts)


class SiftHandle:
    """Handle to a sift. Provides sync convenience methods."""

    def __init__(self, data: dict, client: "Sifter"):
        self._data = data
        self._client = client
        self._callbacks: list[tuple[str, Callable]] = []

    @property
    def id(self) -> str:
        return self._data["id"]

    @property
    def name(self) -> str:
        return self._data.get("name", "")

    @property
    def instructions(self) -> str:
        return self._data.get("instructions", "")

    @property
    def status(self) -> str:
        return self._data.get("status", "")

    def on(
        self,
        event: Union[str, list[str]],
        callback: Callable,
    ) -> "SiftHandle":
        """
        Register a callback for one or more event patterns.

        Patterns support wildcards:
        - '*'  matches any single segment  (e.g. 'document.*')
        - '**' matches any number of segments

        The callback is called during wait() when a matching event fires.
        For 'document.processed', callback receives (document_id, record).
        For 'sift.completed', callback receives (sift_id,).
        For 'sift.error', callback receives (document_id, error).
        """
        if isinstance(event, str):
            event = [event]
        for e in event:
            self._callbacks.append((e, callback))
        return self

    def upload(self, path: str | Path) -> "SiftHandle":
        """Upload documents from a file or directory path."""
        p = Path(path)
        files_to_upload = [f for f in p.iterdir() if f.is_file() and not f.name.startswith(".")] if p.is_dir() else [p]
        headers = self._client._auth_headers()
        import httpx
        with httpx.Client(timeout=300.0) as http:
            form_files = [
                ("files", (f.name, open(f, "rb"), "application/octet-stream"))
                for f in files_to_upload
            ]
            r = http.post(
                f"{self._client.api_url}/api/sifts/{self.id}/upload",
                headers=headers,
                files=form_files,
            )
            r.raise_for_status()
        return self

    def wait(self, poll_interval: float = 2.0, timeout: float = 300.0) -> "SiftHandle":
        """
        Block until the sift is no longer processing.
        Fires registered callbacks when document events occur.
        """
        headers = self._client._auth_headers()
        import httpx

        start = time.time()
        seen_done: set[str] = set()

        while True:
            with httpx.Client() as http:
                r = http.get(
                    f"{self._client.api_url}/api/sifts/{self.id}",
                    headers=headers,
                )
                r.raise_for_status()
                data = r.json()

            self._data = data
            current_status = data.get("status", "")

            # Fire document-level callbacks if any registered
            if self._callbacks:
                self._fire_document_callbacks(http, headers, seen_done)

            if current_status not in ("indexing",):
                if current_status == "active":
                    self._fire_event("sift.completed", self.id)
                elif current_status == "error":
                    self._fire_event("sift.error", self.id, data.get("error"))
                return self

            if time.time() - start > timeout:
                raise TimeoutError(f"Sift did not complete within {timeout}s")
            time.sleep(poll_interval)

    def _fire_document_callbacks(self, http: Any, headers: dict, seen_done: set) -> None:
        """Poll document statuses and fire callbacks for newly completed docs."""
        import httpx
        try:
            with httpx.Client() as h:
                # Get all extraction results to find newly processed docs
                r = h.get(
                    f"{self._client.api_url}/api/sifts/{self.id}/records",
                    headers=headers,
                )
                if r.status_code == 200:
                    records = r.json()
                    for record in records:
                        doc_id = record.get("document_id") or record.get("id", "")
                        if doc_id and doc_id not in seen_done:
                            seen_done.add(doc_id)
                            self._fire_event("sift.document.processed", doc_id, record)
        except Exception:
            pass

    def _fire_event(self, event_name: str, *args) -> None:
        for pattern, cb in self._callbacks:
            if _matches_pattern(pattern, event_name):
                try:
                    cb(*args)
                except Exception:
                    pass

    def records(self, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        """Return extracted records with optional pagination."""
        import httpx
        with httpx.Client() as http:
            r = http.get(
                f"{self._client.api_url}/api/sifts/{self.id}/records",
                headers=self._client._auth_headers(),
                params={"limit": limit, "offset": offset},
            )
            r.raise_for_status()
            data = r.json()
            # API returns a pagination envelope: {"items": [...], "total": N, ...}
            return data["items"] if isinstance(data, dict) else data

    def query(self, nl_query: str) -> list[dict[str, Any]]:
        """Run a natural language query against this sift."""
        import httpx
        with httpx.Client() as http:
            r = http.post(
                f"{self._client.api_url}/api/sifts/{self.id}/query",
                headers=self._client._auth_headers(),
                json={"query": nl_query},
            )
            r.raise_for_status()
            return r.json().get("results", r.json())

    def export_csv(self, output_path: str | Path) -> None:
        """Export records to a CSV file."""
        import httpx
        with httpx.Client() as http:
            r = http.get(
                f"{self._client.api_url}/api/sifts/{self.id}/records/csv",
                headers=self._client._auth_headers(),
            )
            r.raise_for_status()
            Path(output_path).write_text(r.text, encoding="utf-8")

    def update(self, **kwargs) -> "SiftHandle":
        """Update sift properties. Accepts name= and/or instructions=."""
        import httpx
        payload = {}
        if "name" in kwargs:
            payload["name"] = kwargs["name"]
        if "instructions" in kwargs:
            payload["instructions"] = kwargs["instructions"]
        with httpx.Client() as http:
            r = http.patch(
                f"{self._client.api_url}/api/sifts/{self.id}",
                headers=self._client._auth_headers(),
                json=payload,
            )
            r.raise_for_status()
            self._data = r.json()
        return self

    def delete(self) -> None:
        """Delete this sift and all its results."""
        import httpx
        with httpx.Client() as http:
            r = http.delete(
                f"{self._client.api_url}/api/sifts/{self.id}",
                headers=self._client._auth_headers(),
            )
            r.raise_for_status()


class FolderHandle:
    """Handle to a folder. Provides sync convenience methods."""

    def __init__(self, data: dict, client: "Sifter"):
        self._data = data
        self._client = client
        self._callbacks: list[tuple[str, Callable]] = []

    @property
    def id(self) -> str:
        return self._data["id"]

    @property
    def name(self) -> str:
        return self._data.get("name", "")

    def on(
        self,
        event: Union[str, list[str]],
        callback: Callable,
    ) -> "FolderHandle":
        """
        Register a callback for folder events.

        Patterns support wildcards:
        - '*'  matches any single segment
        - '**' matches any number of segments

        For 'folder.document.uploaded', callback receives (document,).
        """
        if isinstance(event, str):
            event = [event]
        for e in event:
            self._callbacks.append((e, callback))
        return self

    def _fire_event(self, event_name: str, *args) -> None:
        for pattern, cb in self._callbacks:
            if _matches_pattern(pattern, event_name):
                try:
                    cb(*args)
                except Exception:
                    pass

    def upload(self, path: str | Path) -> "FolderHandle":
        """Upload documents from a file or directory to this folder."""
        p = Path(path)
        files_to_upload = [f for f in p.iterdir() if f.is_file() and not f.name.startswith(".")] if p.is_dir() else [p]
        headers = self._client._auth_headers()
        import httpx
        with httpx.Client(timeout=300.0) as http:
            for f in files_to_upload:
                r = http.post(
                    f"{self._client.api_url}/api/folders/{self.id}/documents",
                    headers=headers,
                    files={"file": (f.name, open(f, "rb"), "application/octet-stream")},
                )
                r.raise_for_status()
                self._fire_event("folder.document.uploaded", r.json())
        return self

    def documents(self) -> list[dict[str, Any]]:
        """List documents in this folder."""
        import httpx
        with httpx.Client() as http:
            r = http.get(
                f"{self._client.api_url}/api/folders/{self.id}/documents",
                headers=self._client._auth_headers(),
            )
            r.raise_for_status()
            return r.json()

    def add_sift(self, sift: SiftHandle) -> "FolderHandle":
        """Link a sift to this folder. All folder documents will be processed by it."""
        import httpx
        with httpx.Client() as http:
            r = http.post(
                f"{self._client.api_url}/api/folders/{self.id}/extractors",
                headers=self._client._auth_headers(),
                json={"sift_id": sift.id},
            )
            r.raise_for_status()
        return self

    def remove_sift(self, sift: SiftHandle) -> "FolderHandle":
        """Unlink a sift from this folder."""
        import httpx
        with httpx.Client() as http:
            r = http.delete(
                f"{self._client.api_url}/api/folders/{self.id}/extractors/{sift.id}",
                headers=self._client._auth_headers(),
            )
            r.raise_for_status()
        return self

    def sifts(self) -> list[dict[str, Any]]:
        """List sifts linked to this folder."""
        import httpx
        with httpx.Client() as http:
            r = http.get(
                f"{self._client.api_url}/api/folders/{self.id}/extractors",
                headers=self._client._auth_headers(),
            )
            r.raise_for_status()
            return r.json()

    def update(self, **kwargs) -> "FolderHandle":
        """Update folder properties. Accepts name= and/or description=."""
        import httpx
        with httpx.Client() as http:
            r = http.patch(
                f"{self._client.api_url}/api/folders/{self.id}",
                headers=self._client._auth_headers(),
                json=kwargs,
            )
            r.raise_for_status()
            self._data = r.json()
        return self

    def delete(self) -> None:
        """Delete this folder and all its documents."""
        import httpx
        with httpx.Client() as http:
            r = http.delete(
                f"{self._client.api_url}/api/folders/{self.id}",
                headers=self._client._auth_headers(),
            )
            r.raise_for_status()


class Sifter:
    """
    Sifter SDK client. Connects to a running Sifter server.

    Args:
        api_url: URL of the Sifter server (default: http://localhost:8000)
        api_key: API key (or set SIFTER_API_KEY env var)
    """

    def __init__(
        self,
        api_url: str = "http://localhost:8000",
        api_key: str = "",
    ):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key or os.environ.get("SIFTER_API_KEY", "")

    def _auth_headers(self) -> dict:
        if self.api_key:
            return {"X-API-Key": self.api_key}
        return {}

    # ---- Sift CRUD ----

    def create_sift(self, name: str, instructions: str, description: str = "") -> SiftHandle:
        """Create a new sift and return a handle to it."""
        import httpx
        with httpx.Client() as http:
            r = http.post(
                f"{self.api_url}/api/sifts",
                headers=self._auth_headers(),
                json={
                    "name": name,
                    "description": description,
                    "instructions": instructions,
                },
            )
            r.raise_for_status()
            return SiftHandle(r.json(), self)

    def get_sift(self, sift_id: str) -> SiftHandle:
        """Get a handle to an existing sift."""
        import httpx
        with httpx.Client() as http:
            r = http.get(
                f"{self.api_url}/api/sifts/{sift_id}",
                headers=self._auth_headers(),
            )
            r.raise_for_status()
            return SiftHandle(r.json(), self)

    def list_sifts(self) -> list[dict[str, Any]]:
        """List all sifts."""
        import httpx
        with httpx.Client() as http:
            r = http.get(
                f"{self.api_url}/api/sifts",
                headers=self._auth_headers(),
            )
            r.raise_for_status()
            return r.json()

    # ---- Folder CRUD ----

    def create_folder(self, name: str, description: str = "") -> FolderHandle:
        """Create a new folder and return a handle to it."""
        import httpx
        with httpx.Client() as http:
            r = http.post(
                f"{self.api_url}/api/folders",
                headers=self._auth_headers(),
                json={"name": name, "description": description},
            )
            r.raise_for_status()
            return FolderHandle(r.json(), self)

    def get_folder(self, folder_id: str) -> FolderHandle:
        """Get a handle to an existing folder."""
        import httpx
        with httpx.Client() as http:
            r = http.get(
                f"{self.api_url}/api/folders/{folder_id}",
                headers=self._auth_headers(),
            )
            r.raise_for_status()
            return FolderHandle(r.json(), self)

    def list_folders(self) -> list[dict[str, Any]]:
        """List all folders."""
        import httpx
        with httpx.Client() as http:
            r = http.get(
                f"{self.api_url}/api/folders",
                headers=self._auth_headers(),
            )
            r.raise_for_status()
            return r.json()

    # ---- One-liner ----

    def sift(self, path: str | Path, instructions: str) -> list[dict[str, Any]]:
        """
        One-liner convenience: create a temporary sift, upload, wait, return records.
        The sift is deleted after records are retrieved.
        """
        s = self.create_sift("sift-temp", instructions)
        try:
            s.upload(path)
            s.wait()
            return s.records()
        finally:
            s.delete()

    # ---- Webhooks ----

    def register_hook(
        self,
        events: Union[str, list[str]],
        url: str,
        sift_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Register a server-side webhook. The server will POST to `url` when
        matching events occur.

        events: single event name, list, or wildcard pattern ('sift.*', '**')
        url: target URL for HTTP POST delivery
        sift_id: optional — filter to events for a specific sift
        """
        import httpx
        if isinstance(events, str):
            events = [events]
        payload: dict[str, Any] = {"events": events, "url": url}
        if sift_id:
            payload["sift_id"] = sift_id
        with httpx.Client() as http:
            r = http.post(
                f"{self.api_url}/api/webhooks",
                headers=self._auth_headers(),
                json=payload,
            )
            r.raise_for_status()
            return r.json()

    def list_hooks(self) -> list[dict[str, Any]]:
        """List all registered webhooks for the current org."""
        import httpx
        with httpx.Client() as http:
            r = http.get(
                f"{self.api_url}/api/webhooks",
                headers=self._auth_headers(),
            )
            r.raise_for_status()
            return r.json()

    def delete_hook(self, hook_id: str) -> None:
        """Delete a registered webhook."""
        import httpx
        with httpx.Client() as http:
            r = http.delete(
                f"{self.api_url}/api/webhooks/{hook_id}",
                headers=self._auth_headers(),
            )
            r.raise_for_status()
