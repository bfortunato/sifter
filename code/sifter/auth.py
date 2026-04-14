"""
Auth utilities: API key validation + anonymous access.

- No X-API-Key header: anonymous access, acts as "default" principal.
- X-API-Key matches SIFTER_API_KEY config: bootstrap principal.
- X-API-Key matches a DB-stored key: that key's principal.
- X-API-Key provided but invalid: 401.

The cloud layer (sifter-cloud) overrides get_current_principal via
FastAPI dependency_overrides to add JWT support.
"""
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from sifter.config import config
from sifter.db import get_db

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


@dataclass
class Principal:
    key_id: str  # "anonymous", "bootstrap", or MongoDB _id for DB keys


def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def get_current_principal(
    api_key: Optional[str] = Depends(api_key_header),
    db=Depends(get_db),
) -> Principal:
    """FastAPI dependency — validates API key or grants anonymous access."""
    # No key provided — anonymous access unless require_api_key is set
    if not api_key:
        if config.require_api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "ApiKey"},
            )
        return Principal(key_id="anonymous")

    # Check bootstrap key (plaintext match against config)
    if config.api_key and api_key == config.api_key:
        return Principal(key_id="bootstrap")

    # Check DB-stored keys (hashed)
    if api_key.startswith("sk-"):
        key_hash = _hash_api_key(api_key[3:])
        doc = await db["api_keys"].find_one({"key_hash": key_hash, "is_active": True})
        if doc:
            await db["api_keys"].update_one(
                {"_id": doc["_id"]},
                {"$set": {"last_used_at": datetime.now(timezone.utc)}},
            )
            return Principal(key_id=str(doc["_id"]))

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid API key",
        headers={"WWW-Authenticate": "ApiKey"},
    )
