from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import Principal, get_current_principal
from ..db import get_db
from ..services.document_processor import enqueue
from ..services.document_service import DocumentService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/documents", tags=["documents"])


class ReprocessRequest(BaseModel):
    sift_id: Optional[str] = None


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    doc = await svc.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    statuses = await svc.get_document_statuses(document_id)
    return {
        "id": doc.id,
        "filename": doc.filename,
        "original_filename": doc.original_filename,
        "content_type": doc.content_type,
        "size_bytes": doc.size_bytes,
        "folder_id": doc.folder_id,
        "uploaded_at": doc.uploaded_at.isoformat(),
        "sift_statuses": [
            {
                "id": s.id,
                "sift_id": s.sift_id,
                "status": s.status,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                "error_message": s.error_message,
                "sift_record_id": s.sift_record_id,
            }
            for s in statuses
        ],
    }


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    ok = await svc.delete_document(document_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")


@router.post("/{document_id}/reprocess", status_code=status.HTTP_202_ACCEPTED)
async def reprocess_document(
    document_id: str,
    body: ReprocessRequest,
    _: Principal = Depends(get_current_principal),
    db=Depends(get_db),
):
    svc = DocumentService(db)
    doc = await svc.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if body.sift_id:
        sift_ids = [body.sift_id]
    else:
        links = await svc.list_folder_extractors(doc.folder_id)
        sift_ids = [l.sift_id for l in links]

    if not sift_ids:
        raise HTTPException(status_code=400, detail="No sifts linked to this document's folder")

    from ..models.document import DocumentSiftStatusEnum

    enqueued = []
    for sift_id in sift_ids:
        await svc.update_sift_status(document_id, sift_id, DocumentSiftStatusEnum.PENDING)
        await enqueue(document_id, sift_id, doc.storage_path)
        enqueued.append(sift_id)

    return {"document_id": document_id, "enqueued_for": enqueued}
