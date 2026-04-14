"""
Auth utilities: API key validation only. No JWT, no user accounts.
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
    key_id: str  # "bootstrap" for the config key, or MongoDB _id for DB keys


def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def get_current_principal(
    api_key: Optional[str] = Depends(api_key_header),
    db=Depends(get_db),
) -> Principal:
    """FastAPI dependency — validates API key, returns Principal."""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "ApiKey"},
        )

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
        detail="Not authenticated",
        headers={"WWW-Authenticate": "ApiKey"},
    )
