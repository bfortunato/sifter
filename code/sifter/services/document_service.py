"""
Document management service: Folders, Documents, FolderExtractor links,
DocumentExtractionStatus tracking.
"""
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import aiofiles
import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..config import config
from ..models.document import (
    Document,
    DocumentExtractionStatus,
    DocumentExtractionStatusEnum,
    Folder,
    FolderExtractor,
)

logger = structlog.get_logger()


class DocumentService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def ensure_indexes(self):
        await self.db["folders"].create_index("organization_id")
        await self.db["documents"].create_index([("folder_id", 1), ("filename", 1)], unique=True)
        await self.db["documents"].create_index("organization_id")
        await self.db["folder_extractors"].create_index(
            [("folder_id", 1), ("extraction_id", 1)], unique=True
        )
        await self.db["document_extraction_statuses"].create_index(
            [("document_id", 1), ("extraction_id", 1)], unique=True
        )
        await self.db["document_extraction_statuses"].create_index("organization_id")

    # ---- Folders ----

    async def create_folder(self, name: str, description: str, org_id: str) -> Folder:
        folder = Folder(organization_id=org_id, name=name, description=description)
        result = await self.db["folders"].insert_one(folder.to_mongo())
        folder.id = str(result.inserted_id)
        return folder

    async def list_folders(self, org_id: str) -> list[Folder]:
        docs = await self.db["folders"].find({"organization_id": org_id}).to_list(length=None)
        return [Folder.from_mongo(d) for d in docs]

    async def get_folder(self, folder_id: str, org_id: str) -> Optional[Folder]:
        doc = await self.db["folders"].find_one(
            {"_id": ObjectId(folder_id), "organization_id": org_id}
        )
        return Folder.from_mongo(doc) if doc else None

    async def update_folder(self, folder_id: str, org_id: str, updates: dict) -> Optional[Folder]:
        result = await self.db["folders"].find_one_and_update(
            {"_id": ObjectId(folder_id), "organization_id": org_id},
            {"$set": updates},
            return_document=True,
        )
        return Folder.from_mongo(result) if result else None

    async def delete_folder(self, folder_id: str, org_id: str) -> bool:
        # Cascade: delete documents and their statuses
        docs = await self.db["documents"].find(
            {"folder_id": folder_id, "organization_id": org_id}
        ).to_list(length=None)
        for doc in docs:
            doc_id = str(doc["_id"])
            await self._delete_document_files(doc)
            await self.db["document_extraction_statuses"].delete_many({"document_id": doc_id})
        await self.db["documents"].delete_many({"folder_id": folder_id, "organization_id": org_id})
        await self.db["folder_extractors"].delete_many({"folder_id": folder_id})
        result = await self.db["folders"].delete_one(
            {"_id": ObjectId(folder_id), "organization_id": org_id}
        )
        return result.deleted_count > 0

    # ---- Folder ↔ Extractor links ----

    async def link_extractor(self, folder_id: str, extraction_id: str, org_id: str) -> FolderExtractor:
        existing = await self.db["folder_extractors"].find_one(
            {"folder_id": folder_id, "extraction_id": extraction_id}
        )
        if existing:
            return FolderExtractor.from_mongo(existing)
        link = FolderExtractor(
            organization_id=org_id,
            folder_id=folder_id,
            extraction_id=extraction_id,
        )
        result = await self.db["folder_extractors"].insert_one(link.to_mongo())
        link.id = str(result.inserted_id)
        return link

    async def unlink_extractor(self, folder_id: str, extraction_id: str, org_id: str) -> bool:
        result = await self.db["folder_extractors"].delete_one(
            {"folder_id": folder_id, "extraction_id": extraction_id, "organization_id": org_id}
        )
        return result.deleted_count > 0

    async def list_folder_extractors(self, folder_id: str, org_id: str) -> list[FolderExtractor]:
        docs = await self.db["folder_extractors"].find(
            {"folder_id": folder_id, "organization_id": org_id}
        ).to_list(length=None)
        return [FolderExtractor.from_mongo(d) for d in docs]

    # ---- Documents ----

    async def save_document(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        folder_id: str,
        org_id: str,
        uploaded_by: str,
    ) -> Document:
        # Build storage path
        storage_dir = Path(config.storage_path) / org_id / folder_id
        storage_dir.mkdir(parents=True, exist_ok=True)
        storage_path = str(storage_dir / filename)

        # Write file
        async with aiofiles.open(storage_path, "wb") as f:
            await f.write(file_bytes)

        size_bytes = len(file_bytes)
        doc = Document(
            organization_id=org_id,
            folder_id=folder_id,
            filename=filename,
            original_filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            uploaded_by=uploaded_by,
            storage_path=storage_path,
        )
        result = await self.db["documents"].insert_one(doc.to_mongo())
        doc.id = str(result.inserted_id)

        # Increment folder document_count
        await self.db["folders"].update_one(
            {"_id": ObjectId(folder_id)},
            {"$inc": {"document_count": 1}},
        )

        logger.info("document_saved", doc_id=doc.id, folder_id=folder_id, filename=filename)
        return doc

    async def list_documents(self, folder_id: str, org_id: str) -> list[dict[str, Any]]:
        """List documents with per-extractor status for each."""
        docs = await self.db["documents"].find(
            {"folder_id": folder_id, "organization_id": org_id}
        ).to_list(length=None)

        result = []
        for doc in docs:
            doc_id = str(doc["_id"])
            statuses = await self.db["document_extraction_statuses"].find(
                {"document_id": doc_id}
            ).to_list(length=None)
            result.append({
                "id": doc_id,
                "filename": doc["filename"],
                "original_filename": doc.get("original_filename", doc["filename"]),
                "content_type": doc.get("content_type", ""),
                "size_bytes": doc.get("size_bytes", 0),
                "uploaded_by": doc.get("uploaded_by", ""),
                "uploaded_at": doc["uploaded_at"].isoformat() if doc.get("uploaded_at") else None,
                "extraction_statuses": [
                    {
                        "extraction_id": s["extraction_id"],
                        "status": s["status"],
                        "started_at": s["started_at"].isoformat() if s.get("started_at") else None,
                        "completed_at": s["completed_at"].isoformat() if s.get("completed_at") else None,
                        "error_message": s.get("error_message"),
                        "extraction_record_id": s.get("extraction_record_id"),
                    }
                    for s in statuses
                ],
            })
        return result

    async def get_document(self, document_id: str, org_id: str) -> Optional[Document]:
        doc = await self.db["documents"].find_one(
            {"_id": ObjectId(document_id), "organization_id": org_id}
        )
        return Document.from_mongo(doc) if doc else None

    async def delete_document(self, document_id: str, org_id: str) -> bool:
        doc = await self.db["documents"].find_one(
            {"_id": ObjectId(document_id), "organization_id": org_id}
        )
        if not doc:
            return False
        await self._delete_document_files(doc)
        await self.db["document_extraction_statuses"].delete_many({"document_id": document_id})
        result = await self.db["documents"].delete_one({"_id": ObjectId(document_id)})
        if result.deleted_count > 0:
            await self.db["folders"].update_one(
                {"_id": ObjectId(doc["folder_id"])},
                {"$inc": {"document_count": -1}},
            )
        return result.deleted_count > 0

    async def _delete_document_files(self, doc: dict):
        storage_path = doc.get("storage_path")
        if storage_path and os.path.exists(storage_path):
            try:
                os.remove(storage_path)
            except OSError:
                pass

    # ---- DocumentExtractionStatus ----

    async def create_extraction_status(
        self, document_id: str, extraction_id: str, org_id: str
    ) -> DocumentExtractionStatus:
        status = DocumentExtractionStatus(
            organization_id=org_id,
            document_id=document_id,
            extraction_id=extraction_id,
            status=DocumentExtractionStatusEnum.PENDING,
        )
        result = await self.db["document_extraction_statuses"].insert_one(status.to_mongo())
        status.id = str(result.inserted_id)
        return status

    async def update_extraction_status(
        self,
        document_id: str,
        extraction_id: str,
        status: DocumentExtractionStatusEnum,
        error_message: Optional[str] = None,
        extraction_record_id: Optional[str] = None,
    ) -> None:
        updates: dict = {"status": status}
        now = datetime.now(timezone.utc)
        if status == DocumentExtractionStatusEnum.PROCESSING:
            updates["started_at"] = now
        elif status in (DocumentExtractionStatusEnum.DONE, DocumentExtractionStatusEnum.ERROR):
            updates["completed_at"] = now
        if error_message is not None:
            updates["error_message"] = error_message
        if extraction_record_id is not None:
            updates["extraction_record_id"] = extraction_record_id
        await self.db["document_extraction_statuses"].update_one(
            {"document_id": document_id, "extraction_id": extraction_id},
            {"$set": updates},
        )

    async def get_document_statuses(self, document_id: str) -> list[DocumentExtractionStatus]:
        docs = await self.db["document_extraction_statuses"].find(
            {"document_id": document_id}
        ).to_list(length=None)
        return [DocumentExtractionStatus.from_mongo(d) for d in docs]
