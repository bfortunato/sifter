from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
async def get_config():
    """Deployment configuration — no auth required.

    Returns the deployment mode so the frontend can adapt its UI.
    sifter-cloud overrides this endpoint to return {"mode": "cloud"}.
    """
    return {"mode": "oss"}
