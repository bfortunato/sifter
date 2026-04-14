import os
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .api import aggregations, auth, chat, documents, sifts, folders, keys, orgs, webhooks
from .config import config
from .db import close as close_db, get_db
from .limiter import limiter
from .services.aggregation_service import AggregationService
from .services.auth_service import AuthService
from .services.document_processor import ensure_indexes as ensure_queue_indexes, start_workers
from .services.document_service import DocumentService
from .services.extraction_service import SiftService
from .services.webhook_service import WebhookService

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO level
)

logger = structlog.get_logger()

_worker_tasks = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker_tasks
    # Startup
    logger.info("sifter_starting", mongodb_uri=config.mongodb_uri, model=config.llm_model)
    os.makedirs(config.upload_dir, exist_ok=True)
    os.makedirs(config.storage_path, exist_ok=True)

    db = get_db()
    await SiftService(db).ensure_indexes()
    await AggregationService(db).ensure_indexes()
    await AuthService(db).ensure_indexes()
    await DocumentService(db).ensure_indexes()
    await WebhookService(db).ensure_indexes()
    await ensure_queue_indexes(db)

    # Start background document processing workers
    _worker_tasks = start_workers(config.max_workers, db)

    logger.info("sifter_ready")

    yield

    # Shutdown
    for task in _worker_tasks:
        task.cancel()
    _worker_tasks = []
    await close_db()
    logger.info("sifter_shutdown")


app = FastAPI(
    title="Sifter",
    description="AI-powered document extraction engine",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(keys.router)
app.include_router(orgs.router)
app.include_router(sifts.router)
app.include_router(aggregations.router)
app.include_router(chat.router)
app.include_router(folders.router)
app.include_router(documents.router)
app.include_router(webhooks.router)


@app.get("/health")
async def health():
    db = get_db()
    components = {}

    # Check DB
    try:
        await db.command("ping")
        components["database"] = "ok"
    except Exception as e:
        components["database"] = f"error: {str(e)}"

    # Queue depth
    try:
        pending = await db["processing_queue"].count_documents({"status": "pending"})
        processing = await db["processing_queue"].count_documents({"status": "processing"})
        components["queue"] = {"status": "ok", "pending": pending, "processing": processing}
    except Exception:
        components["queue"] = {"status": "error"}

    overall = "ok" if all(
        (v == "ok" if isinstance(v, str) else v.get("status") == "ok")
        for v in components.values()
    ) else "error"

    status_code = 200 if overall == "ok" else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=status_code,
        content={"status": overall, "version": "0.1.0", "components": components}
    )


# Serve frontend static files if built
_frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")


def run():
    uvicorn.run(
        "sifter.main:app",
        host=config.host,
        port=config.port,
        reload=True,
    )


if __name__ == "__main__":
    run()
