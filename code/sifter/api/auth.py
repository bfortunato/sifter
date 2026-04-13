from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from sifter.auth import Principal, create_access_token, get_current_principal
from sifter.db import get_db
from sifter.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class SwitchOrgRequest(BaseModel):
    org_id: str


def _user_dict(user) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "created_at": user.created_at.isoformat(),
    }


@router.post("/register")
async def register(body: RegisterRequest, db=Depends(get_db)):
    svc = AuthService(db)
    try:
        user, org, token = await svc.register(body.email, body.password, body.full_name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_dict(user),
        "org_id": org.id,
    }


@router.post("/login")
async def login(body: LoginRequest, db=Depends(get_db)):
    svc = AuthService(db)
    try:
        user, token = await svc.login(body.email, body.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_dict(user),
    }


@router.get("/me")
async def me(principal: Principal = Depends(get_current_principal), db=Depends(get_db)):
    svc = AuthService(db)
    user = await svc.get_user(principal.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {**_user_dict(user), "org_id": principal.org_id, "via": principal.via}


@router.post("/switch-org")
async def switch_org(
    body: SwitchOrgRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = AuthService(db)
    try:
        token = await svc.switch_org(principal.user_id, body.org_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return {"access_token": token, "token_type": "bearer"}
