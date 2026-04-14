# Auth endpoints removed — Sifter OSS uses API key authentication only.
# User registration/login is handled by the cloud platform.
# See /api/keys for API key management.
from fastapi import APIRouter

router = APIRouter(prefix="/api/auth", tags=["auth"])
