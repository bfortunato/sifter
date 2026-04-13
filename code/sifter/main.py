import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

from .api import extractions, aggregations, chat
from .config import config
from .db import close as close_db, get_db
from .services.extraction_service import ExtractionService
from .services.aggregation_service import AggregationService

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ]
)

logger = structlog.get_logger()

app = FastAPI(
    title="Sifter",
    description="AI-powered document extraction engine",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extractions.router)
app.include_router(aggregations.router)
app.include_router(chat.router)


@app.on_event("startup")
async def startup():
    logger.info("sifter_starting", mongodb_uri=config.mongodb_uri, model=config.llm_model)
    os.makedirs(config.upload_dir, exist_ok=True)

    # Ensure DB indexes
    db = get_db()
    ext_svc = ExtractionService(db)
    agg_svc = AggregationService(db)
    await ext_svc.ensure_indexes()
    await agg_svc.ensure_indexes()
    logger.info("sifter_ready")


@app.on_event("shutdown")
async def shutdown():
    await close_db()
    logger.info("sifter_shutdown")


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
