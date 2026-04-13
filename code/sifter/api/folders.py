from typing import Optional

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from ..auth import Principal, get_current_principal
from ..config import config
from ..db import get_db
from ..models.document import Folder
from ..services.document_processor import enqueue
from ..services.document_service import DocumentService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/folders", tags=["folders"])


class CreateFolderRequest(BaseModel):
    name: str
    description: str = ""


class UpdateFolderRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class LinkExtractorRequest(BaseModel):
    extraction_id: str


def _folder_dict(f: Folder) -> dict:
    return {
        "id": f.id,
        "organization_id": f.organization_id,
        "name": f.name,
        "description": f.description,
        "document_count": f.document_count,
        "created_at": f.created_at.isoformat(),
    }


@router.get("")
async def list_folders(
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    folders = await svc.list_folders(principal.org_id)
    return [_folder_dict(f) for f in folders]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_folder(
    body: CreateFolderRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    await svc.ensure_indexes()
    folder = await svc.create_folder(body.name, body.description, principal.org_id)
    return _folder_dict(folder)


@router.get("/{folder_id}")
async def get_folder(
    folder_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    folder = await svc.get_folder(folder_id, principal.org_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    extractors = await svc.list_folder_extractors(folder_id, principal.org_id)
    return {
        **_folder_dict(folder),
        "extractors": [
            {
                "id": e.id,
                "extraction_id": e.extraction_id,
                "created_at": e.created_at.isoformat(),
            }
            for e in extractors
        ],
    }


@router.patch("/{folder_id}")
async def update_folder(
    folder_id: str,
    body: UpdateFolderRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    folder = await svc.update_folder(folder_id, principal.org_id, updates)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return _folder_dict(folder)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    ok = await svc.delete_folder(folder_id, principal.org_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Folder not found")


# ---- Folder ↔ Extractor links ----

@router.get("/{folder_id}/extractors")
async def list_extractors(
    folder_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    folder = await svc.get_folder(folder_id, principal.org_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    links = await svc.list_folder_extractors(folder_id, principal.org_id)
    return [
        {
            "id": l.id,
            "extraction_id": l.extraction_id,
            "created_at": l.created_at.isoformat(),
        }
        for l in links
    ]


@router.post("/{folder_id}/extractors", status_code=status.HTTP_201_CREATED)
async def link_extractor(
    folder_id: str,
    body: LinkExtractorRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    folder = await svc.get_folder(folder_id, principal.org_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    link = await svc.link_extractor(folder_id, body.extraction_id, principal.org_id)

    # Enqueue all existing folder documents for the newly linked sift
    existing_docs = await db["documents"].find(
        {"folder_id": folder_id, "organization_id": principal.org_id}
    ).to_list(length=None)

    enqueued = 0
    for doc in existing_docs:
        doc_id = str(doc["_id"])
        storage_path = doc.get("storage_path")
        if not storage_path:
            continue
        # Check no status already exists for this doc+extraction pair
        existing = await db["document_extraction_statuses"].find_one(
            {"document_id": doc_id, "extraction_id": body.extraction_id}
        )
        if existing:
            continue
        await svc.create_extraction_status(doc_id, body.extraction_id, principal.org_id)
        enqueue(doc_id, body.extraction_id, storage_path, principal.org_id)
        enqueued += 1

    return {
        "id": link.id,
        "folder_id": link.folder_id,
        "extraction_id": link.extraction_id,
        "created_at": link.created_at.isoformat(),
        "enqueued_existing": enqueued,
    }


@router.delete("/{folder_id}/extractors/{extraction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_extractor(
    folder_id: str,
    extraction_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    ok = await svc.unlink_extractor(folder_id, extraction_id, principal.org_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Link not found")


# ---- Documents ----

@router.get("/{folder_id}/documents")
async def list_documents(
    folder_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    folder = await svc.get_folder(folder_id, principal.org_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return await svc.list_documents(folder_id, principal.org_id)


@router.post("/{folder_id}/documents", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    folder_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
    file: UploadFile = File(...),
):
    svc = DocumentService(db)
    folder = await svc.get_folder(folder_id, principal.org_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    max_bytes = config.max_file_size_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds max size of {config.max_file_size_mb}MB",
        )

    # Save document
    doc = await svc.save_document(
        file_bytes=content,
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        folder_id=folder_id,
        org_id=principal.org_id,
        uploaded_by=principal.user_id,
    )

    # Get linked extractors and enqueue processing for each
    links = await svc.list_folder_extractors(folder_id, principal.org_id)
    enqueued = []
    for link in links:
        await svc.create_extraction_status(doc.id, link.extraction_id, principal.org_id)
        enqueue(doc.id, link.extraction_id, doc.storage_path, principal.org_id)
        enqueued.append(link.extraction_id)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "size_bytes": doc.size_bytes,
        "enqueued_for": enqueued,
    }
