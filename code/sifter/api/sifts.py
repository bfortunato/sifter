import asyncio
import os
from pathlib import Path
from typing import Optional

import aiofiles
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from ..auth import Principal, get_current_principal
from ..config import config
from ..db import get_db
from ..deps import get_usage_limiter
from ..models.sift import Sift, SiftStatus
from ..services.limits import NoopLimiter
from ..services.sift_results import SiftResultsService
from ..services.sift_service import SiftService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/sifts", tags=["sifts"])


class CreateSiftRequest(BaseModel):
    name: str
    description: str = ""
    instructions: str
    schema: Optional[str] = None


class UpdateSiftRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    schema: Optional[str] = None


class QueryRequest(BaseModel):
    query: str


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("", response_model=dict)
async def create_sift(
    body: CreateSiftRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
    limiter: NoopLimiter = Depends(get_usage_limiter),
):
    await limiter.check_sift_create(principal.org_id)
    svc = SiftService(db)
    await svc.ensure_indexes()
    sift = await svc.create(
        name=body.name,
        description=body.description,
        instructions=body.instructions,
        schema=body.schema,
        org_id=principal.org_id,
    )
    return _sift_to_dict(sift)


@router.get("", response_model=dict)
async def list_sifts(
    limit: int = 50,
    offset: int = 0,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sifts, total = await svc.list_all(org_id=principal.org_id, skip=offset, limit=limit)
    return {"items": [_sift_to_dict(s) for s in sifts], "total": total, "limit": limit, "offset": offset}


@router.get("/{sift_id}", response_model=dict)
async def get_sift(
    sift_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id, org_id=principal.org_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")
    return _sift_to_dict(sift)


@router.patch("/{sift_id}", response_model=dict)
async def update_sift(
    sift_id: str,
    body: UpdateSiftRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    sift = await svc.update(sift_id, updates)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")
    return _sift_to_dict(sift)


@router.delete("/{sift_id}")
async def delete_sift(
    sift_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    deleted = await svc.delete(sift_id, org_id=principal.org_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Sift not found")
    return {"deleted": True}


@router.post("/{sift_id}/upload")
async def upload_documents(
    sift_id: str,
    background_tasks: BackgroundTasks,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
    files: list[UploadFile] = File(...),
    limiter: NoopLimiter = Depends(get_usage_limiter),
):
    await limiter.check_upload(principal.org_id, 0)
    svc = SiftService(db)
    sift = await svc.get(sift_id, org_id=principal.org_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    upload_dir = Path(config.upload_dir) / sift_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    max_bytes = config.max_file_size_mb * 1024 * 1024
    saved_paths = []

    for file in files:
        dest = upload_dir / file.filename
        content = await file.read()
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File {file.filename} exceeds max size of {config.max_file_size_mb}MB",
            )
        async with aiofiles.open(dest, "wb") as f:
            await f.write(content)
        saved_paths.append(str(dest))

    background_tasks.add_task(svc.process_documents, sift_id, saved_paths)

    return {"uploaded": len(saved_paths), "files": [f.filename for f in files]}


@router.post("/{sift_id}/reindex")
async def reindex_sift(
    sift_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    from ..services.document_service import DocumentService
    from ..services.document_processor import enqueue
    from ..models.document import DocumentSiftStatusEnum

    svc = SiftService(db)
    doc_svc = DocumentService(db)

    sift = await svc.get(sift_id, org_id=principal.org_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    # Find all documents that were processed by this sift (folder-based)
    statuses = await db["document_sift_statuses"].find(
        {"sift_id": sift_id, "organization_id": principal.org_id}
    ).to_list(length=None)

    folder_doc_paths: list[tuple[str, str]] = []  # (document_id, storage_path)
    for s in statuses:
        doc = await db["documents"].find_one({"_id": __import__("bson").ObjectId(s["document_id"])})
        if doc and doc.get("storage_path"):
            folder_doc_paths.append((s["document_id"], doc["storage_path"]))

    # Also collect directly-uploaded files (legacy path)
    upload_dir = Path(config.upload_dir) / sift_id
    direct_paths = []
    if upload_dir.exists():
        direct_paths = [
            str(p) for p in upload_dir.iterdir()
            if p.is_file() and not p.name.startswith(".")
        ]

    if not folder_doc_paths and not direct_paths:
        raise HTTPException(status_code=400, detail="No documents found to reindex")

    # Clear existing results
    await svc.results_service.delete_by_sift_id(sift_id)
    await svc.update(
        sift_id,
        {
            "status": SiftStatus.INDEXING,
            "schema": None,
            "processed_documents": 0,
            "total_documents": len(folder_doc_paths) + len(direct_paths),
            "error": None,
        },
    )

    # Re-enqueue folder-based documents through the queue
    for doc_id, storage_path in folder_doc_paths:
        await db["document_sift_statuses"].update_one(
            {"document_id": doc_id, "sift_id": sift_id},
            {"$set": {"status": DocumentSiftStatusEnum.PENDING, "error_message": None, "sift_record_id": None}},
        )
        await enqueue(doc_id, sift_id, storage_path, principal.org_id)

    # Re-process direct-uploaded files via background task (old path)
    if direct_paths:
        import asyncio
        asyncio.create_task(svc.process_documents(sift_id, direct_paths))

    total = len(folder_doc_paths) + len(direct_paths)
    return {"status": "reindexing", "total": total}


@router.post("/{sift_id}/reset")
async def reset_sift(
    sift_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id, org_id=principal.org_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")
    result = await svc.reset_error(sift_id)
    return _sift_to_dict(result)


@router.get("/{sift_id}/records")
async def get_records(
    sift_id: str,
    limit: int = 50,
    offset: int = 0,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id, org_id=principal.org_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")
    records, total = await svc.get_records(sift_id, org_id=principal.org_id, skip=offset, limit=limit)
    return {"items": records, "total": total, "limit": limit, "offset": offset}


@router.get("/{sift_id}/records/csv")
async def export_csv(
    sift_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id, org_id=principal.org_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    results_svc = SiftResultsService(db)
    csv_content = await results_svc.export_csv(sift_id, org_id=principal.org_id)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{sift.name}.csv"',
        },
    )


@router.post("/{sift_id}/query")
async def query_sift(
    sift_id: str,
    body: QueryRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id, org_id=principal.org_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    from ..services.aggregation_service import AggregationService

    agg_svc = AggregationService(db)
    try:
        results, pipeline = await agg_svc.live_query(
            sift_id, body.query, org_id=principal.org_id
        )
    except Exception as e:
        logger.error("live_query_error", sift_id=sift_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return {"results": results, "pipeline": pipeline}


@router.post("/{sift_id}/chat")
async def sift_chat(
    sift_id: str,
    body: ChatRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    from ..services.qa_agent import chat as qa_chat

    svc = SiftService(db)
    sift = await svc.get(sift_id, org_id=principal.org_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    try:
        result = await qa_chat(
            extraction_id=sift_id,
            message=body.message,
            history=body.history,
            org_id=principal.org_id,
            db=db,
        )
    except Exception as e:
        logger.error("sift_chat_error", sift_id=sift_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "response": result.response,
        "data": result.data,
        "pipeline": result.pipeline,
    }


def _sift_to_dict(s: Sift) -> dict:
    return {
        "id": s.id,
        "organization_id": s.organization_id,
        "name": s.name,
        "description": s.description,
        "instructions": s.instructions,
        "schema": s.schema,
        "status": s.status,
        "error": s.error,
        "processed_documents": s.processed_documents,
        "total_documents": s.total_documents,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }
