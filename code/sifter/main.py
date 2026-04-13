import os
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import aggregations, auth, chat, documents, extractions, folders, keys, orgs, webhooks
from .config import config
from .db import close as close_db, get_db
from .services.aggregation_service import AggregationService
from .services.auth_service import AuthService
from .services.document_processor import start_workers
from .services.document_service import DocumentService
from .services.extraction_service import ExtractionService
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
    await ExtractionService(db).ensure_indexes()
    await AggregationService(db).ensure_indexes()
    await AuthService(db).ensure_indexes()
    await DocumentService(db).ensure_indexes()
    await WebhookService(db).ensure_indexes()

    # Start background document processing workers
    _worker_tasks = start_workers(config.max_workers)

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
app.include_router(extractions.router)
app.include_router(aggregations.router)
app.include_router(chat.router)
app.include_router(folders.router)
app.include_router(documents.router)
app.include_router(webhooks.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


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
