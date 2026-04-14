"""
Background document processing queue backed by MongoDB.
Workers poll the processing_queue collection and atomically claim tasks.
"""
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.document import DocumentSiftStatusEnum
from ..models.processing_task import ProcessingTask
from .limits import NoopLimiter

logger = structlog.get_logger()

# Module-level db reference set at startup
_db: Optional[AsyncIOMotorDatabase] = None

# Module-level limiter — cloud can replace this with StripeLimiter
_limiter = NoopLimiter()

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
    org_id: str,
) -> None:
    """Insert a ProcessingTask into MongoDB processing_queue."""
    global _db
    if _db is None:
        # Lazy init: fall back to the global DB connection (e.g. during tests)
        from ..db import get_db
        _db = get_db()
    task = ProcessingTask(
        document_id=document_id,
        sift_id=sift_id,
        storage_path=storage_path,
        org_id=org_id,
    )
    await _db[COLLECTION].insert_one(task.to_mongo())
    logger.info(
        "task_enqueued",
        document_id=document_id,
        sift_id=sift_id,
    )


async def _claim_task(db: AsyncIOMotorDatabase) -> Optional[dict]:
    """Atomically claim the next available task from the queue."""
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    task_doc = await db[COLLECTION].find_one_and_update(
        {
            "$or": [
                {"status": "pending"},
                {"status": "error", "attempts": {"$lt": 3}},
                # reclaim stale processing tasks (claimed > 10 min ago)
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
    """
    Continuous worker coroutine. Polls MongoDB for tasks. Runs until cancelled.
    """
    # Import here to avoid circular imports at module load time
    from .document_service import DocumentService
    from .sift_service import SiftService

    logger.info("document_processor_worker_started")
    while True:
        task_doc = await _claim_task(db)

        if task_doc is None:
            await asyncio.sleep(2)
            continue

        doc_id = str(task_doc["_id"])
        document_id = task_doc["document_id"]
        sift_id = task_doc["sift_id"]
        storage_path = task_doc["storage_path"]
        org_id = task_doc["org_id"]
        attempts = task_doc.get("attempts", 1)
        max_attempts = task_doc.get("max_attempts", 3)

        doc_svc = DocumentService(db)
        ext_svc = SiftService(db)

        logger.info(
            "processing_document",
            document_id=document_id,
            sift_id=sift_id,
            attempt=attempts,
        )

        try:
            # Mark document as processing
            await doc_svc.update_sift_status(
                document_id,
                sift_id,
                DocumentSiftStatusEnum.PROCESSING,
            )

            # Run extraction
            result = await ext_svc.process_single_document(sift_id, storage_path)

            # Mark document as done
            await doc_svc.update_sift_status(
                document_id,
                sift_id,
                DocumentSiftStatusEnum.DONE,
                sift_record_id=result.id,
            )

            # Mark task as done in queue
            await db[COLLECTION].update_one(
                {"_id": task_doc["_id"]},
                {"$set": {"status": "done", "completed_at": datetime.now(timezone.utc)}},
            )

            # Record usage metering
            await _limiter.record_processed(org_id, 1)

            logger.info(
                "document_processed",
                document_id=document_id,
                sift_id=sift_id,
                confidence=result.confidence,
            )

            # Dispatch webhook event
            await _dispatch_webhook(
                db=db,
                org_id=org_id,
                event="sift.document.processed",
                payload={
                    "document_id": document_id,
                    "sift_id": sift_id,
                    "record_id": result.id,
                },
                sift_id=sift_id,
            )

        except Exception as e:
            error_msg = str(e)
            logger.error(
                "document_processing_failed",
                document_id=document_id,
                sift_id=sift_id,
                error=error_msg,
                attempt=attempts,
            )

            # Determine if we should retry or mark as permanently failed
            if attempts < max_attempts:
                # Reset to pending for retry
                await db[COLLECTION].update_one(
                    {"_id": task_doc["_id"]},
                    {
                        "$set": {
                            "status": "pending",
                            "claimed_at": None,
                            "error_message": error_msg,
                        }
                    },
                )
            else:
                # Permanently failed
                await db[COLLECTION].update_one(
                    {"_id": task_doc["_id"]},
                    {"$set": {"status": "error", "error_message": error_msg}},
                )

            try:
                await doc_svc.update_sift_status(
                    document_id,
                    sift_id,
                    DocumentSiftStatusEnum.ERROR,
                    error_message=error_msg,
                )
                await _dispatch_webhook(
                    db=db,
                    org_id=org_id,
                    event="sift.error",
                    payload={
                        "document_id": document_id,
                        "sift_id": sift_id,
                        "error": error_msg,
                    },
                    sift_id=sift_id,
                )
            except Exception as update_err:
                logger.error("status_update_failed", error=str(update_err))


async def _dispatch_webhook(db, org_id: str, event: str, payload: dict, sift_id: Optional[str] = None) -> None:
    """Fire-and-forget webhook dispatch. Failures are logged but never raised."""
    try:
        from .webhook_service import WebhookService
        svc = WebhookService(db)
        await svc.dispatch(org_id=org_id, event=event, payload=payload, sift_id=sift_id)
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
