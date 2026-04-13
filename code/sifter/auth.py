"""
Auth utilities: Principal dataclass, get_current_principal() FastAPI dependency,
password hashing, JWT creation/validation.
"""
import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, APIKeyHeader
from jose import JWTError, jwt
from passlib.context import CryptContext

from sifter.config import config
from sifter.db import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


@dataclass
class Principal:
    user_id: str
    org_id: str
    via: Literal["jwt", "api_key"]


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, org_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=config.jwt_expire_minutes)
    payload = {
        "sub": user_id,
        "org_id": org_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, config.jwt_secret, algorithm="HS256")


def _hash_api_key(key_without_prefix: str) -> str:
    return hashlib.sha256(key_without_prefix.encode()).hexdigest()


async def get_current_principal(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    api_key: Optional[str] = Depends(api_key_header),
    db=Depends(get_db),
) -> Principal:
    """FastAPI dependency — validates JWT or API key, returns Principal."""
    # Try JWT first
    if credentials and credentials.scheme.lower() == "bearer":
        try:
            payload = jwt.decode(credentials.credentials, config.jwt_secret, algorithms=["HS256"])
            user_id = payload.get("sub")
            org_id = payload.get("org_id")
            if user_id and org_id:
                return Principal(user_id=user_id, org_id=org_id, via="jwt")
        except JWTError:
            pass

    # Try API key
    if api_key and api_key.startswith("sk-"):
        key_without_prefix = api_key[3:]  # strip "sk-"
        key_hash = _hash_api_key(key_without_prefix)
        doc = await db["api_keys"].find_one({"key_hash": key_hash, "is_active": True})
        if doc:
            # Update last_used_at asynchronously (best-effort)
            await db["api_keys"].update_one(
                {"_id": doc["_id"]},
                {"$set": {"last_used_at": datetime.now(timezone.utc)}},
            )
            return Principal(
                user_id=str(doc["created_by"]),
                org_id=str(doc["organization_id"]),
                via="api_key",
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
