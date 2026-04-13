import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.sift import Sift, SiftStatus
from ..models.sift_result import SiftResult
from . import sift_agent
from .sift_results import SiftResultsService
from .file_processor import FileProcessor

logger = structlog.get_logger()

COLLECTION = "sifts"


class SiftService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db[COLLECTION]
        self.results_service = SiftResultsService(db)
        self.file_processor = FileProcessor()

    async def ensure_indexes(self):
        await self.col.create_index("created_at", name="created_at_idx")
        await self.col.create_index("organization_id", name="organization_id_idx")
        await self.results_service.ensure_indexes()

    async def create(
        self,
        name: str,
        description: str,
        instructions: str,
        schema: Optional[str] = None,
        org_id: Optional[str] = None,
    ) -> Sift:
        sift = Sift(
            organization_id=org_id,
            name=name,
            description=description,
            instructions=instructions,
            schema=schema,
            status=SiftStatus.ACTIVE,
        )
        doc = sift.to_mongo()
        result = await self.col.insert_one(doc)
        sift.id = str(result.inserted_id)
        logger.info("sift_created", sift_id=sift.id, name=name)
        return sift

    async def get(self, sift_id: str, org_id: Optional[str] = None) -> Optional[Sift]:
        query: dict = {"_id": ObjectId(sift_id)}
        if org_id:
            query["organization_id"] = org_id
        doc = await self.col.find_one(query)
        return Sift.from_mongo(doc) if doc else None

    async def list_all(self, org_id: Optional[str] = None) -> list[Sift]:
        query: dict = {}
        if org_id:
            query["organization_id"] = org_id
        cursor = self.col.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=None)
        return [Sift.from_mongo(d) for d in docs]

    async def delete(self, sift_id: str, org_id: Optional[str] = None) -> bool:
        query: dict = {"_id": ObjectId(sift_id)}
        if org_id:
            query["organization_id"] = org_id
        await self.results_service.delete_by_sift_id(sift_id)
        result = await self.col.delete_one(query)
        return result.deleted_count > 0

    async def update(self, sift_id: str, updates: dict) -> Optional[Sift]:
        updates["updated_at"] = datetime.now(timezone.utc)
        await self.col.update_one(
            {"_id": ObjectId(sift_id)},
            {"$set": updates},
        )
        return await self.get(sift_id)

    async def reset_error(self, sift_id: str) -> Optional[Sift]:
        return await self.update(
            sift_id,
            {"status": SiftStatus.ACTIVE, "error": None},
        )

    async def process_documents(
        self,
        sift_id: str,
        file_paths: list[str],
    ) -> None:
        """
        Process a list of documents for a sift.
        Updates status, progress counters, and infers schema after first doc.
        """
        sift = await self.get(sift_id)
        if not sift:
            logger.error("sift_not_found", sift_id=sift_id)
            return

        total = len(file_paths)
        await self.update(
            sift_id,
            {
                "status": SiftStatus.INDEXING,
                "total_documents": total,
                "processed_documents": 0,
                "error": None,
            },
        )

        schema = sift.schema
        errors = []

        for idx, file_path in enumerate(file_paths):
            try:
                result = await sift_agent.extract(
                    file_path=file_path,
                    instructions=sift.instructions,
                    schema=schema,
                )

                document_id = Path(file_path).name
                await self.results_service.insert_result(
                    sift_id=sift_id,
                    document_id=document_id,
                    document_type=result.document_type,
                    confidence=result.confidence,
                    extracted_data=result.extracted_data,
                    org_id=sift.organization_id,
                )

                # Infer schema from first successful result
                if schema is None and result.extracted_data:
                    schema = _infer_schema(result.extracted_data)
                    await self.update(sift_id, {"schema": schema})

                await self.update(sift_id, {"processed_documents": idx + 1})
                logger.info(
                    "document_processed",
                    sift_id=sift_id,
                    document=Path(file_path).name,
                    confidence=result.confidence,
                )
            except Exception as e:
                logger.error(
                    "document_processing_error",
                    sift_id=sift_id,
                    file=str(file_path),
                    error=str(e),
                )
                errors.append(f"{Path(file_path).name}: {e}")

        final_status = SiftStatus.ACTIVE
        error_msg = None
        if errors and len(errors) == total:
            final_status = SiftStatus.ERROR
            error_msg = "; ".join(errors[:3])
        elif errors:
            error_msg = f"{len(errors)} document(s) failed: " + "; ".join(errors[:3])

        await self.update(
            sift_id,
            {
                "status": final_status,
                "error": error_msg,
                "processed_documents": total - len(errors),
            },
        )
        logger.info(
            "sift_processing_complete",
            sift_id=sift_id,
            total=total,
            errors=len(errors),
        )

    async def process_single_document(
        self, sift_id: str, file_path: str
    ) -> SiftResult:
        sift = await self.get(sift_id)
        if not sift:
            raise ValueError(f"Sift {sift_id} not found")

        result = await sift_agent.extract(
            file_path=file_path,
            instructions=sift.instructions,
            schema=sift.schema,
        )

        document_id = Path(file_path).name
        stored = await self.results_service.insert_result(
            sift_id=sift_id,
            document_id=document_id,
            document_type=result.document_type,
            confidence=result.confidence,
            extracted_data=result.extracted_data,
            org_id=sift.organization_id,
        )

        if not sift.schema and result.extracted_data:
            schema = _infer_schema(result.extracted_data)
            await self.update(sift_id, {"schema": schema})

        count = await self.results_service.count(sift_id)
        await self.update(
            sift_id,
            {
                "processed_documents": count,
                "total_documents": count,
                "status": SiftStatus.ACTIVE,
            },
        )
        return stored

    async def reindex(self, sift_id: str, file_paths: list[str]) -> None:
        """Delete all results and reprocess all documents."""
        await self.results_service.delete_by_sift_id(sift_id)
        await self.update(
            sift_id,
            {"schema": None, "processed_documents": 0, "total_documents": 0},
        )
        await self.process_documents(sift_id, file_paths)

    async def get_records(self, sift_id: str, org_id: Optional[str] = None) -> list[dict[str, Any]]:
        results = await self.results_service.get_results(sift_id, org_id=org_id)
        return [
            {
                "id": r.id,
                "document_id": r.document_id,
                "document_type": r.document_type,
                "confidence": r.confidence,
                "extracted_data": r.extracted_data,
                "created_at": r.created_at.isoformat(),
            }
            for r in results
        ]


def _infer_schema(extracted_data: dict[str, Any]) -> str:
    """
    Generate a schema string from extracted data.
    Example: "client (string), date (string), amount (number), vat_number (string)"
    """
    parts = []
    for field, value in extracted_data.items():
        if value is None:
            type_str = "string"
        elif isinstance(value, bool):
            type_str = "boolean"
        elif isinstance(value, int | float):
            type_str = "number"
        elif isinstance(value, list):
            type_str = "array"
        elif isinstance(value, dict):
            type_str = "object"
        else:
            type_str = "string"
        parts.append(f"{field} ({type_str})")
    return ", ".join(parts)
