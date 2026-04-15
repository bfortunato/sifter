"""
Background document processing queue backed by MongoDB.
Workers poll the processing_queue collection and atomically claim tasks.
Single-tenant — no org_id.
"""
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.document import DocumentSiftStatusEnum
from ..models.processing_task import ProcessingTask

logger = structlog.get_logger()

# Module-level db reference set at startup
_db: Optional[AsyncIOMotorDatabase] = None

COLLECTION = "processing_queue"


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes on the processing_queue collection."""
    await db[COLLECTION].create_index(
        [("status", 1), ("created_at", 1)],
        name="status_created_at_idx",
    )
    await db[COLLECTION].create_index("document_id", name="document_id_idx")


async def enqueue(
    document_id: str,
    sift_id: str,
    storage_path: str,
) -> None:
    """Insert a ProcessingTask into MongoDB processing_queue."""
    global _db
    if _db is None:
        from ..db import get_db
        _db = get_db()
    task = ProcessingTask(
        document_id=document_id,
        sift_id=sift_id,
        storage_path=storage_path,
    )
    await _db[COLLECTION].insert_one(task.to_mongo())
    logger.info("task_enqueued", document_id=document_id, sift_id=sift_id)


async def _claim_task(db: AsyncIOMotorDatabase) -> Optional[dict]:
    """Atomically claim the next available task from the queue."""
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    task_doc = await db[COLLECTION].find_one_and_update(
        {
            "$or": [
                {"status": "pending"},
                {"status": "error", "attempts": {"$lt": 3}},
                {"status": "processing", "claimed_at": {"$lt": stale_cutoff}},
            ]
        },
        {
            "$set": {"status": "processing", "claimed_at": datetime.now(timezone.utc)},
            "$inc": {"attempts": 1},
        },
        sort=[("created_at", 1)],
        return_document=True,
    )
    return task_doc


async def worker(db: AsyncIOMotorDatabase) -> None:
    """Continuous worker coroutine. Polls MongoDB for tasks. Runs until cancelled."""
    from .document_service import DocumentService
    from .sift_service import SiftService

    logger.info("document_processor_worker_started")
    while True:
        task_doc = await _claim_task(db)

        if task_doc is None:
            await asyncio.sleep(2)
            continue

        document_id = task_doc["document_id"]
        sift_id = task_doc["sift_id"]
        storage_path = task_doc["storage_path"]
        attempts = task_doc.get("attempts", 1)
        max_attempts = task_doc.get("max_attempts", 3)

        doc_svc = DocumentService(db)
        ext_svc = SiftService(db)

        logger.info("processing_document", document_id=document_id, sift_id=sift_id, attempt=attempts)

        try:
            await doc_svc.update_sift_status(document_id, sift_id, DocumentSiftStatusEnum.PROCESSING)

            from ..storage import local_path as storage_local_path
            async with storage_local_path(storage_path) as local_file:
                result = await ext_svc.process_single_document(sift_id, local_file)

            await doc_svc.update_sift_status(
                document_id, sift_id, DocumentSiftStatusEnum.DONE, sift_record_id=result.id
            )

            await db[COLLECTION].update_one(
                {"_id": task_doc["_id"]},
                {"$set": {"status": "done", "completed_at": datetime.now(timezone.utc)}},
            )

            logger.info("document_processed", document_id=document_id, sift_id=sift_id)

            # Record usage (no-op in OSS; cloud overrides get_usage_limiter)
            from .limits import NoopLimiter
            await NoopLimiter().record_processed(org_id="default", doc_count=1)

            await _dispatch_webhook(
                db=db,
                event="sift.document.processed",
                payload={"document_id": document_id, "sift_id": sift_id, "record_id": result.id},
                sift_id=sift_id,
            )

        except Exception as e:
            error_msg = str(e)
            logger.error("document_processing_failed", document_id=document_id, sift_id=sift_id, error=error_msg, attempt=attempts)

            if attempts < max_attempts:
                await db[COLLECTION].update_one(
                    {"_id": task_doc["_id"]},
                    {"$set": {"status": "pending", "claimed_at": None, "error_message": error_msg}},
                )
            else:
                await db[COLLECTION].update_one(
                    {"_id": task_doc["_id"]},
                    {"$set": {"status": "error", "error_message": error_msg}},
                )

            try:
                await doc_svc.update_sift_status(document_id, sift_id, DocumentSiftStatusEnum.ERROR, error_message=error_msg)
                await _dispatch_webhook(
                    db=db,
                    event="sift.error",
                    payload={"document_id": document_id, "sift_id": sift_id, "error": error_msg},
                    sift_id=sift_id,
                )
            except Exception as update_err:
                logger.error("status_update_failed", error=str(update_err))


async def _dispatch_webhook(db, event: str, payload: dict, sift_id: Optional[str] = None) -> None:
    """Fire-and-forget webhook dispatch."""
    try:
        from .webhook_service import WebhookService
        svc = WebhookService(db)
        await svc.dispatch(event=event, payload=payload, sift_id=sift_id)
    except Exception as e:
        logger.warning("webhook_dispatch_error", error=str(e))


def start_workers(n: int, db: AsyncIOMotorDatabase) -> list[asyncio.Task]:
    """Start n worker tasks. Call from lifespan startup."""
    global _db
    _db = db
    tasks = []
    for i in range(n):
        t = asyncio.create_task(worker(db), name=f"doc-processor-{i}")
        tasks.append(t)
    logger.info("document_processor_workers_started", count=n)
    return tasks
