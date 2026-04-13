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
from ..models.extraction import Extraction, ExtractionStatus
from ..services.extraction_results import ExtractionResultsService
from ..services.extraction_service import ExtractionService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/extractions", tags=["extractions"])


class CreateExtractionRequest(BaseModel):
    name: str
    description: str = ""
    extraction_instructions: str
    extraction_schema: Optional[str] = None


class QueryRequest(BaseModel):
    query: str


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("", response_model=dict)
async def create_extraction(
    body: CreateExtractionRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = ExtractionService(db)
    await svc.ensure_indexes()
    extraction = await svc.create(
        name=body.name,
        description=body.description,
        instructions=body.extraction_instructions,
        schema=body.extraction_schema,
        org_id=principal.org_id,
    )
    return _extraction_to_dict(extraction)


@router.get("", response_model=list[dict])
async def list_extractions(
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = ExtractionService(db)
    extractions = await svc.list_all(org_id=principal.org_id)
    return [_extraction_to_dict(e) for e in extractions]


@router.get("/{extraction_id}", response_model=dict)
async def get_extraction(
    extraction_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = ExtractionService(db)
    extraction = await svc.get(extraction_id, org_id=principal.org_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return _extraction_to_dict(extraction)


@router.delete("/{extraction_id}")
async def delete_extraction(
    extraction_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = ExtractionService(db)
    deleted = await svc.delete(extraction_id, org_id=principal.org_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return {"deleted": True}


@router.post("/{extraction_id}/upload")
async def upload_documents(
    extraction_id: str,
    background_tasks: BackgroundTasks,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
    files: list[UploadFile] = File(...),
):
    svc = ExtractionService(db)
    extraction = await svc.get(extraction_id, org_id=principal.org_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    upload_dir = Path(config.upload_dir) / extraction_id
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

    background_tasks.add_task(svc.process_documents, extraction_id, saved_paths)

    return {"uploaded": len(saved_paths), "files": [f.filename for f in files]}


@router.post("/{extraction_id}/reindex")
async def reindex_extraction(
    extraction_id: str,
    background_tasks: BackgroundTasks,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = ExtractionService(db)
    extraction = await svc.get(extraction_id, org_id=principal.org_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    upload_dir = Path(config.upload_dir) / extraction_id
    if not upload_dir.exists():
        raise HTTPException(status_code=400, detail="No documents uploaded for this extraction")

    file_paths = [
        str(p)
        for p in upload_dir.iterdir()
        if p.is_file() and not p.name.startswith(".")
    ]
    if not file_paths:
        raise HTTPException(status_code=400, detail="No documents found to reindex")

    background_tasks.add_task(svc.reindex, extraction_id, file_paths)
    return {"status": "reindexing", "total": len(file_paths)}


@router.post("/{extraction_id}/reset")
async def reset_extraction(
    extraction_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = ExtractionService(db)
    extraction = await svc.get(extraction_id, org_id=principal.org_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    result = await svc.reset_error(extraction_id)
    return _extraction_to_dict(result)


@router.get("/{extraction_id}/records")
async def get_records(
    extraction_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = ExtractionService(db)
    extraction = await svc.get(extraction_id, org_id=principal.org_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return await svc.get_records(extraction_id, org_id=principal.org_id)


@router.get("/{extraction_id}/records/csv")
async def export_csv(
    extraction_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = ExtractionService(db)
    extraction = await svc.get(extraction_id, org_id=principal.org_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    results_svc = ExtractionResultsService(db)
    csv_content = await results_svc.export_csv(extraction_id, org_id=principal.org_id)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{extraction.name}.csv"',
        },
    )


@router.post("/{extraction_id}/query")
async def query_extraction(
    extraction_id: str,
    body: QueryRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = ExtractionService(db)
    extraction = await svc.get(extraction_id, org_id=principal.org_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    from ..services.aggregation_service import AggregationService

    agg_svc = AggregationService(db)
    try:
        results, pipeline = await agg_svc.live_query(
            extraction_id, body.query, org_id=principal.org_id
        )
    except Exception as e:
        logger.error("live_query_error", extraction_id=extraction_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return {"results": results, "pipeline": pipeline}


@router.post("/{extraction_id}/chat")
async def extraction_chat(
    extraction_id: str,
    body: ChatRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    from ..services.qa_agent import chat as qa_chat

    svc = ExtractionService(db)
    extraction = await svc.get(extraction_id, org_id=principal.org_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    try:
        result = await qa_chat(
            extraction_id=extraction_id,
            message=body.message,
            history=body.history,
            org_id=principal.org_id,
            db=db,
        )
    except Exception as e:
        logger.error("extraction_chat_error", extraction_id=extraction_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "response": result.response,
        "data": result.data,
        "pipeline": result.pipeline,
    }


def _extraction_to_dict(e: Extraction) -> dict:
    return {
        "id": e.id,
        "organization_id": e.organization_id,
        "name": e.name,
        "description": e.description,
        "extraction_instructions": e.extraction_instructions,
        "extraction_schema": e.extraction_schema,
        "status": e.status,
        "extraction_error": e.extraction_error,
        "processed_documents": e.processed_documents,
        "total_documents": e.total_documents,
        "created_at": e.created_at.isoformat(),
        "updated_at": e.updated_at.isoformat(),
    }
