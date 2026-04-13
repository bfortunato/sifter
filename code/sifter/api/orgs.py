from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from sifter.auth import Principal, get_current_principal
from sifter.db import get_db
from sifter.models.user import OrgRole
from sifter.services.auth_service import AuthService

router = APIRouter(prefix="/api/orgs", tags=["organizations"])


class CreateOrgRequest(BaseModel):
    name: str


class AddMemberRequest(BaseModel):
    email: str
    role: OrgRole = OrgRole.MEMBER


def _org_dict(org) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "created_at": org.created_at.isoformat(),
    }


@router.get("")
async def list_orgs(
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = AuthService(db)
    orgs = await svc.list_orgs_for_user(principal.user_id)
    return [_org_dict(o) for o in orgs]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_org(
    body: CreateOrgRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = AuthService(db)
    org, token = await svc.create_org(body.name, principal.user_id)
    return {"org": _org_dict(org), "access_token": token, "token_type": "bearer"}


@router.get("/{org_id}/members")
async def list_members(
    org_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = AuthService(db)
    org = await svc.get_org(org_id, principal.user_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return await svc.list_members(org_id)


@router.post("/{org_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    org_id: str,
    body: AddMemberRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = AuthService(db)
    org = await svc.get_org(org_id, principal.user_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    try:
        member = await svc.add_member(org_id, body.email, body.role)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {
        "user_id": member.user_id,
        "org_id": member.org_id,
        "role": member.role,
        "joined_at": member.joined_at.isoformat(),
    }
