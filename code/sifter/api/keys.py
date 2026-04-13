from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from sifter.auth import Principal, get_current_principal
from sifter.db import get_db
from sifter.services.auth_service import AuthService

router = APIRouter(prefix="/api/keys", tags=["keys"])


class CreateKeyRequest(BaseModel):
    name: str


def _key_dict(key, include_hash: bool = False) -> dict:
    d = {
        "id": key.id,
        "name": key.name,
        "key_prefix": key.key_prefix,
        "organization_id": key.organization_id,
        "created_by": key.created_by,
        "created_at": key.created_at.isoformat(),
        "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
        "is_active": key.is_active,
    }
    return d


@router.get("")
async def list_keys(
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = AuthService(db)
    keys = await svc.list_api_keys(principal.org_id)
    return [_key_dict(k) for k in keys]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_key(
    body: CreateKeyRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = AuthService(db)
    key, plaintext = await svc.create_api_key(body.name, principal.org_id, principal.user_id)
    return {"key": _key_dict(key), "plaintext": plaintext}


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_key(
    key_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = AuthService(db)
    ok = await svc.revoke_api_key(key_id, principal.org_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Key not found")
