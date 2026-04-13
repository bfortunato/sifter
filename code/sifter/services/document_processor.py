"""
Background document processing queue.
Workers pick up (document_id, extraction_id, org_id) tasks and run extraction.
"""
import asyncio
from dataclasses import dataclass
from typing import Optional

import structlog

from ..db import get_db
from ..models.document import DocumentExtractionStatusEnum

logger = structlog.get_logger()

_queue: asyncio.Queue = asyncio.Queue()


@dataclass
class ProcessingTask:
    document_id: str
    extraction_id: str
    storage_path: str
    org_id: str


def enqueue(document_id: str, extraction_id: str, storage_path: str, org_id: str) -> None:
    """Add a processing task to the queue (non-async, safe to call from async context)."""
    task = ProcessingTask(
        document_id=document_id,
        extraction_id=extraction_id,
        storage_path=storage_path,
        org_id=org_id,
    )
    _queue.put_nowait(task)
    logger.info(
        "task_enqueued",
        document_id=document_id,
        extraction_id=extraction_id,
        queue_size=_queue.qsize(),
    )


async def worker() -> None:
    """
    Continuous worker coroutine. Runs until cancelled.
    """
    # Import here to avoid circular imports at module load time
    from .document_service import DocumentService
    from .extraction_service import ExtractionService

    logger.info("document_processor_worker_started")
    while True:
        task: ProcessingTask = await _queue.get()
        db = get_db()
        doc_svc = DocumentService(db)
        ext_svc = ExtractionService(db)

        logger.info(
            "processing_document",
            document_id=task.document_id,
            extraction_id=task.extraction_id,
        )

        try:
            # Mark as processing
            await doc_svc.update_extraction_status(
                task.document_id,
                task.extraction_id,
                DocumentExtractionStatusEnum.PROCESSING,
            )

            # Run extraction
            result = await ext_svc.process_single_document(task.extraction_id, task.storage_path)

            # Mark as done
            await doc_svc.update_extraction_status(
                task.document_id,
                task.extraction_id,
                DocumentExtractionStatusEnum.DONE,
                extraction_record_id=result.id,
            )
            logger.info(
                "document_processed",
                document_id=task.document_id,
                extraction_id=task.extraction_id,
                confidence=result.confidence,
            )
        except Exception as e:
            logger.error(
                "document_processing_failed",
                document_id=task.document_id,
                extraction_id=task.extraction_id,
                error=str(e),
            )
            try:
                await doc_svc.update_extraction_status(
                    task.document_id,
                    task.extraction_id,
                    DocumentExtractionStatusEnum.ERROR,
                    error_message=str(e),
                )
            except Exception as update_err:
                logger.error("status_update_failed", error=str(update_err))
        finally:
            _queue.task_done()


def start_workers(n: int) -> list[asyncio.Task]:
    """Start n worker tasks. Call from lifespan startup."""
    tasks = []
    for i in range(n):
        t = asyncio.create_task(worker(), name=f"doc-processor-{i}")
        tasks.append(t)
    logger.info("document_processor_workers_started", count=n)
    return tasks
