from typing import Optional

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from ..auth import Principal, get_current_principal
from ..config import config
from ..db import get_db
from ..deps import get_usage_limiter
from ..models.document import Folder
from ..services.document_processor import enqueue
from ..services.document_service import DocumentService
from ..services.limits import NoopLimiter

logger = structlog.get_logger()
router = APIRouter(prefix="/api/folders", tags=["folders"])


class CreateFolderRequest(BaseModel):
    name: str
    description: str = ""


class UpdateFolderRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class LinkSiftRequest(BaseModel):
    sift_id: str


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
                "sift_id": e.sift_id,
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


# ---- Folder ↔ Sift links ----

@router.get("/{folder_id}/sifts")
async def list_sifts_for_folder(
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
            "sift_id": l.sift_id,
            "created_at": l.created_at.isoformat(),
        }
        for l in links
    ]


@router.post("/{folder_id}/sifts", status_code=status.HTTP_201_CREATED)
async def link_sift(
    folder_id: str,
    body: LinkSiftRequest,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    folder = await svc.get_folder(folder_id, principal.org_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    link = await svc.link_extractor(folder_id, body.sift_id, principal.org_id)

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
        # Check no status already exists for this doc+sift pair
        existing = await db["document_sift_statuses"].find_one(
            {"document_id": doc_id, "sift_id": body.sift_id}
        )
        if existing:
            continue
        await svc.create_sift_status(doc_id, body.sift_id, principal.org_id)
        enqueue(doc_id, body.sift_id, storage_path, principal.org_id)
        enqueued += 1

    return {
        "id": link.id,
        "folder_id": link.folder_id,
        "sift_id": link.sift_id,
        "created_at": link.created_at.isoformat(),
        "enqueued_existing": enqueued,
    }


@router.delete("/{folder_id}/sifts/{sift_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_sift(
    folder_id: str,
    sift_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    ok = await svc.unlink_extractor(folder_id, sift_id, principal.org_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Link not found")


# ---- Legacy extractor routes (backward compat) ----

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
            "sift_id": l.sift_id,
            "extraction_id": l.sift_id,  # legacy compat
            "created_at": l.created_at.isoformat(),
        }
        for l in links
    ]


@router.post("/{folder_id}/extractors", status_code=status.HTTP_201_CREATED)
async def link_extractor(
    folder_id: str,
    body: dict,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    # Accept both sift_id and extraction_id for backward compat
    sift_id = body.get("sift_id") or body.get("extraction_id")
    if not sift_id:
        raise HTTPException(status_code=422, detail="sift_id is required")

    svc = DocumentService(db)
    folder = await svc.get_folder(folder_id, principal.org_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    link = await svc.link_extractor(folder_id, sift_id, principal.org_id)

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
        existing = await db["document_sift_statuses"].find_one(
            {"document_id": doc_id, "sift_id": sift_id}
        )
        if existing:
            continue
        await svc.create_sift_status(doc_id, sift_id, principal.org_id)
        enqueue(doc_id, sift_id, storage_path, principal.org_id)
        enqueued += 1

    return {
        "id": link.id,
        "folder_id": link.folder_id,
        "sift_id": link.sift_id,
        "extraction_id": link.sift_id,  # legacy compat
        "created_at": link.created_at.isoformat(),
        "enqueued_existing": enqueued,
    }


@router.delete("/{folder_id}/extractors/{sift_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_extractor(
    folder_id: str,
    sift_id: str,
    principal: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    ok = await svc.unlink_extractor(folder_id, sift_id, principal.org_id)
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
    limiter: NoopLimiter = Depends(get_usage_limiter),
):
    await limiter.check_upload(principal.org_id, 0)
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

    # Get linked sifts and enqueue processing for each
    links = await svc.list_folder_extractors(folder_id, principal.org_id)
    enqueued = []
    for link in links:
        await svc.create_sift_status(doc.id, link.sift_id, principal.org_id)
        enqueue(doc.id, link.sift_id, doc.storage_path, principal.org_id)
        enqueued.append(link.sift_id)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "size_bytes": doc.size_bytes,
        "enqueued_for": enqueued,
    }
