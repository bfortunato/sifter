import asyncio
import os
from pathlib import Path
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from ..auth import Principal, get_current_principal
from ..config import config
from ..db import get_db
from ..limiter import limiter
from ..models.sift import Sift, SiftStatus
from ..services.limits import NoopLimiter, get_usage_limiter
from ..services.sift_results import SiftResultsService
from ..services.sift_service import SiftService
from ..storage import get_storage_backend

logger = structlog.get_logger()
router = APIRouter(prefix="/api/sifts", tags=["sifts"])


class CreateSiftRequest(BaseModel):
    name: str
    description: str = ""
    instructions: str
    schema: Optional[str] = None
    multi_record: bool = False


class UpdateSiftRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    schema: Optional[str] = None
    multi_record: Optional[bool] = None


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
    usage: NoopLimiter = Depends(get_usage_limiter),
):
    from ..services.document_service import DocumentService

    await usage.check_sift_create(principal.key_id)
    svc = SiftService(db)
    doc_svc = DocumentService(db)
    await svc.ensure_indexes()
    await doc_svc.ensure_indexes()

    sift = await svc.create(
        name=body.name,
        description=body.description,
        instructions=body.instructions,
        schema=body.schema,
        multi_record=body.multi_record,
    )

    # Create default folder, link it, and store its ID on the sift
    folder = await doc_svc.create_folder(body.name, "")
    await doc_svc.link_extractor(folder.id, sift.id)
    sift = await svc.update(sift.id, {"default_folder_id": folder.id})

    return _sift_to_dict(sift)


@router.get("", response_model=dict)
async def list_sifts(
    limit: int = 50,
    offset: int = 0,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sifts, total = await svc.list_all(skip=offset, limit=limit)
    return {"items": [_sift_to_dict(s) for s in sifts], "total": total, "limit": limit, "offset": offset}


@router.get("/{sift_id}", response_model=dict)
async def get_sift(
    sift_id: str,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")
    return _sift_to_dict(sift)


@router.patch("/{sift_id}", response_model=dict)
async def update_sift(
    sift_id: str,
    body: UpdateSiftRequest,
    _: Principal = Depends(get_current_principal),
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
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    deleted = await svc.delete(sift_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Sift not found")
    # Clean up stale folder-extractor links so queued tasks don't fail with
    # "Sift not found" for documents already associated with this sift.
    await db["folder_extractors"].delete_many({"sift_id": sift_id})
    await db["document_sift_statuses"].delete_many({"sift_id": sift_id})
    await db["processing_queue"].delete_many({"sift_id": sift_id, "status": {"$in": ["pending", "processing"]}})
    return {"deleted": True}


@router.post("/{sift_id}/upload")
@limiter.limit("30/minute")
async def upload_documents(
    request: Request,
    sift_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
    usage: NoopLimiter = Depends(get_usage_limiter),
    files: list[UploadFile] = File(...),
):
    from ..services.document_service import DocumentService
    from ..services.document_processor import enqueue

    svc = SiftService(db)
    doc_svc = DocumentService(db)

    sift = await svc.get(sift_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    # Ensure a default folder exists (lazy creation for pre-existing sifts)
    folder_id = sift.default_folder_id
    if not folder_id:
        folder = await doc_svc.create_folder(sift.name, "")
        await doc_svc.link_extractor(folder.id, sift_id)
        await svc.update(sift_id, {"default_folder_id": folder.id})
        folder_id = folder.id

    max_bytes = config.max_file_size_mb * 1024 * 1024
    storage = get_storage_backend()
    uploaded_files = []

    for file in files:
        content = await file.read()
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File {file.filename} exceeds max size of {config.max_file_size_mb}MB",
            )
        await usage.check_upload(principal.key_id, len(content))

        storage_path = await storage.save(folder_id, file.filename, content)
        doc = await doc_svc.save_document(
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            folder_id=folder_id,
            size_bytes=len(content),
            storage_path=storage_path,
        )
        await doc_svc.create_sift_status(doc.id, sift_id)
        await enqueue(doc.id, sift_id, storage_path)
        uploaded_files.append(file.filename)

    return {"uploaded": len(uploaded_files), "files": uploaded_files, "folder_id": folder_id}


@router.post("/{sift_id}/reindex")
async def reindex_sift(
    sift_id: str,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    from ..services.document_service import DocumentService
    from ..services.document_processor import enqueue
    from ..models.document import DocumentSiftStatusEnum

    svc = SiftService(db)
    doc_svc = DocumentService(db)

    sift = await svc.get(sift_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    statuses = await db["document_sift_statuses"].find(
        {"sift_id": sift_id}
    ).to_list(length=None)

    folder_doc_paths: list[tuple[str, str]] = []
    for s in statuses:
        doc = await db["documents"].find_one({"_id": __import__("bson").ObjectId(s["document_id"])})
        if doc and doc.get("storage_path"):
            folder_doc_paths.append((s["document_id"], doc["storage_path"]))

    upload_dir = Path(config.upload_dir) / sift_id
    direct_paths = []
    if upload_dir.exists():
        direct_paths = [
            str(p) for p in upload_dir.iterdir()
            if p.is_file() and not p.name.startswith(".")
        ]

    if not folder_doc_paths and not direct_paths:
        raise HTTPException(status_code=400, detail="No documents found to reindex")

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

    for doc_id, storage_path in folder_doc_paths:
        await db["document_sift_statuses"].update_one(
            {"document_id": doc_id, "sift_id": sift_id},
            {"$set": {"status": DocumentSiftStatusEnum.PENDING, "error_message": None, "sift_record_id": None}},
        )
        await enqueue(doc_id, sift_id, storage_path)

    if direct_paths:
        asyncio.create_task(svc.process_documents(sift_id, direct_paths))

    total = len(folder_doc_paths) + len(direct_paths)
    return {"status": "reindexing", "total": total}


@router.post("/{sift_id}/reset")
async def reset_sift(
    sift_id: str,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")
    result = await svc.reset_error(sift_id)
    return _sift_to_dict(result)


@router.get("/{sift_id}/documents")
async def list_sift_documents(
    sift_id: str,
    limit: int = 50,
    offset: int = 0,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    total = await db["document_sift_statuses"].count_documents({"sift_id": sift_id})
    statuses = await (
        db["document_sift_statuses"]
        .find({"sift_id": sift_id})
        .sort("_id", -1)
        .skip(offset)
        .limit(limit)
        .to_list(length=limit)
    )

    items = []
    for s in statuses:
        doc_id = s.get("document_id")
        doc = await db["documents"].find_one({"_id": __import__("bson").ObjectId(doc_id)}) if doc_id else None
        items.append({
            "document_id": doc_id,
            "filename": doc["filename"] if doc else None,
            "folder_id": doc["folder_id"] if doc else None,
            "size_bytes": doc.get("size_bytes", 0) if doc else 0,
            "uploaded_at": doc["uploaded_at"].isoformat() if doc and doc.get("uploaded_at") else None,
            "status": s.get("status"),
            "started_at": s["started_at"].isoformat() if s.get("started_at") else None,
            "completed_at": s["completed_at"].isoformat() if s.get("completed_at") else None,
            "error_message": s.get("error_message"),
            "filter_reason": s.get("filter_reason"),
            "sift_record_id": s.get("sift_record_id") or s.get("extraction_record_id"),
        })

    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{sift_id}/records")
async def get_records(
    sift_id: str,
    limit: int = 50,
    offset: int = 0,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")
    records, total = await svc.get_records(sift_id, skip=offset, limit=limit)
    return {"items": records, "total": total, "limit": limit, "offset": offset}


@router.get("/{sift_id}/records/csv")
async def export_csv(
    sift_id: str,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    results_svc = SiftResultsService(db)
    csv_content = await results_svc.export_csv(sift_id)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{sift.name}.csv"'},
    )


@router.post("/{sift_id}/query")
async def query_sift(
    sift_id: str,
    body: QueryRequest,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = SiftService(db)
    sift = await svc.get(sift_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    from ..services.aggregation_service import AggregationService

    agg_svc = AggregationService(db)
    try:
        results, pipeline = await agg_svc.live_query(sift_id, body.query)
    except Exception as e:
        logger.error("live_query_error", sift_id=sift_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return {"results": results, "pipeline": pipeline}


@router.post("/{sift_id}/chat")
async def sift_chat(
    sift_id: str,
    body: ChatRequest,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    from ..services.qa_agent import chat as qa_chat

    svc = SiftService(db)
    sift = await svc.get(sift_id)
    if not sift:
        raise HTTPException(status_code=404, detail="Sift not found")

    try:
        result = await qa_chat(
            extraction_id=sift_id,
            message=body.message,
            history=body.history,
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
        "name": s.name,
        "description": s.description,
        "instructions": s.instructions,
        "schema": s.schema,
        "status": s.status,
        "error": s.error,
        "processed_documents": s.processed_documents,
        "total_documents": s.total_documents,
        "default_folder_id": s.default_folder_id,
        "multi_record": s.multi_record,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }
