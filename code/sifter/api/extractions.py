import asyncio
import os
from pathlib import Path
from typing import Optional

import aiofiles
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from ..config import config
from ..db import get_db
from ..models.extraction import Extraction, ExtractionStatus
from ..services.extraction_results import ExtractionResultsService
from ..services.extraction_service import ExtractionService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/extractions", tags=["extractions"])


def _get_service() -> ExtractionService:
    return ExtractionService(get_db())


def _get_results_service() -> ExtractionResultsService:
    return ExtractionResultsService(get_db())


class CreateExtractionRequest(BaseModel):
    name: str
    description: str = ""
    extraction_instructions: str
    extraction_schema: Optional[str] = None


class QueryRequest(BaseModel):
    query: str


@router.post("", response_model=dict)
async def create_extraction(body: CreateExtractionRequest):
    svc = _get_service()
    await svc.ensure_indexes()
    extraction = await svc.create(
        name=body.name,
        description=body.description,
        instructions=body.extraction_instructions,
        schema=body.extraction_schema,
    )
    return _extraction_to_dict(extraction)


@router.get("", response_model=list[dict])
async def list_extractions():
    svc = _get_service()
    extractions = await svc.list_all()
    return [_extraction_to_dict(e) for e in extractions]


@router.get("/{extraction_id}", response_model=dict)
async def get_extraction(extraction_id: str):
    svc = _get_service()
    extraction = await svc.get(extraction_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return _extraction_to_dict(extraction)


@router.delete("/{extraction_id}")
async def delete_extraction(extraction_id: str):
    svc = _get_service()
    deleted = await svc.delete(extraction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return {"deleted": True}


@router.post("/{extraction_id}/upload")
async def upload_documents(
    extraction_id: str,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
):
    svc = _get_service()
    extraction = await svc.get(extraction_id)
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
async def reindex_extraction(extraction_id: str, background_tasks: BackgroundTasks):
    svc = _get_service()
    extraction = await svc.get(extraction_id)
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
async def reset_extraction(extraction_id: str):
    svc = _get_service()
    extraction = await svc.reset_error(extraction_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return _extraction_to_dict(extraction)


@router.get("/{extraction_id}/records")
async def get_records(extraction_id: str):
    svc = _get_service()
    extraction = await svc.get(extraction_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return await svc.get_records(extraction_id)


@router.get("/{extraction_id}/records/csv")
async def export_csv(extraction_id: str):
    svc = _get_service()
    extraction = await svc.get(extraction_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    results_svc = _get_results_service()
    csv_content = await results_svc.export_csv(extraction_id)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{extraction.name}.csv"',
        },
    )


@router.post("/{extraction_id}/query")
async def query_extraction(extraction_id: str, body: QueryRequest):
    svc = _get_service()
    extraction = await svc.get(extraction_id)
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    from ..services.aggregation_service import AggregationService

    agg_svc = AggregationService(get_db())
    try:
        results, pipeline_json = await agg_svc.live_query(extraction_id, body.query)
    except Exception as e:
        logger.error("live_query_error", extraction_id=extraction_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return {"results": results, "pipeline": pipeline_json}


def _extraction_to_dict(e: Extraction) -> dict:
    return {
        "id": e.id,
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
