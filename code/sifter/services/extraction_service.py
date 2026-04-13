import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.extraction import Extraction, ExtractionStatus
from ..models.extraction_result import ExtractionResult
from . import extraction_agent
from .extraction_results import ExtractionResultsService
from .file_processor import FileProcessor

logger = structlog.get_logger()

COLLECTION = "extractions"


class ExtractionService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db[COLLECTION]
        self.results_service = ExtractionResultsService(db)
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
    ) -> Extraction:
        extraction = Extraction(
            organization_id=org_id,
            name=name,
            description=description,
            extraction_instructions=instructions,
            extraction_schema=schema,
            status=ExtractionStatus.ACTIVE,
        )
        doc = extraction.to_mongo()
        result = await self.col.insert_one(doc)
        extraction.id = str(result.inserted_id)
        logger.info("extraction_created", extraction_id=extraction.id, name=name)
        return extraction

    async def get(self, extraction_id: str, org_id: Optional[str] = None) -> Optional[Extraction]:
        query: dict = {"_id": ObjectId(extraction_id)}
        if org_id:
            query["organization_id"] = org_id
        doc = await self.col.find_one(query)
        return Extraction.from_mongo(doc) if doc else None

    async def list_all(self, org_id: Optional[str] = None) -> list[Extraction]:
        query: dict = {}
        if org_id:
            query["organization_id"] = org_id
        cursor = self.col.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=None)
        return [Extraction.from_mongo(d) for d in docs]

    async def delete(self, extraction_id: str, org_id: Optional[str] = None) -> bool:
        query: dict = {"_id": ObjectId(extraction_id)}
        if org_id:
            query["organization_id"] = org_id
        await self.results_service.delete_by_extraction_id(extraction_id)
        result = await self.col.delete_one(query)
        return result.deleted_count > 0

    async def update(self, extraction_id: str, updates: dict) -> Optional[Extraction]:
        updates["updated_at"] = datetime.now(timezone.utc)
        await self.col.update_one(
            {"_id": ObjectId(extraction_id)},
            {"$set": updates},
        )
        return await self.get(extraction_id)

    async def reset_error(self, extraction_id: str) -> Optional[Extraction]:
        return await self.update(
            extraction_id,
            {"status": ExtractionStatus.ACTIVE, "extraction_error": None},
        )

    async def process_documents(
        self,
        extraction_id: str,
        file_paths: list[str],
    ) -> None:
        """
        Process a list of documents for an extraction.
        Updates status, progress counters, and infers schema after first doc.
        """
        extraction = await self.get(extraction_id)
        if not extraction:
            logger.error("extraction_not_found", extraction_id=extraction_id)
            return

        total = len(file_paths)
        await self.update(
            extraction_id,
            {
                "status": ExtractionStatus.INDEXING,
                "total_documents": total,
                "processed_documents": 0,
                "extraction_error": None,
            },
        )

        schema = extraction.extraction_schema
        errors = []

        for idx, file_path in enumerate(file_paths):
            try:
                result = await extraction_agent.extract(
                    file_path=file_path,
                    instructions=extraction.extraction_instructions,
                    schema=schema,
                )

                document_id = Path(file_path).name
                await self.results_service.insert_result(
                    extraction_id=extraction_id,
                    document_id=document_id,
                    document_type=result.document_type,
                    confidence=result.confidence,
                    extracted_data=result.extracted_data,
                    org_id=extraction.organization_id,
                )

                # Infer schema from first successful result
                if schema is None and result.extracted_data:
                    schema = _infer_schema(result.extracted_data)
                    await self.update(extraction_id, {"extraction_schema": schema})

                await self.update(extraction_id, {"processed_documents": idx + 1})
                logger.info(
                    "document_processed",
                    extraction_id=extraction_id,
                    document=Path(file_path).name,
                    confidence=result.confidence,
                )
            except Exception as e:
                logger.error(
                    "document_processing_error",
                    extraction_id=extraction_id,
                    file=str(file_path),
                    error=str(e),
                )
                errors.append(f"{Path(file_path).name}: {e}")

        final_status = ExtractionStatus.ACTIVE
        error_msg = None
        if errors and len(errors) == total:
            final_status = ExtractionStatus.ERROR
            error_msg = "; ".join(errors[:3])
        elif errors:
            error_msg = f"{len(errors)} document(s) failed: " + "; ".join(errors[:3])

        await self.update(
            extraction_id,
            {
                "status": final_status,
                "extraction_error": error_msg,
                "processed_documents": total - len(errors),
            },
        )
        logger.info(
            "extraction_processing_complete",
            extraction_id=extraction_id,
            total=total,
            errors=len(errors),
        )

    async def process_single_document(
        self, extraction_id: str, file_path: str
    ) -> ExtractionResult:
        extraction = await self.get(extraction_id)
        if not extraction:
            raise ValueError(f"Extraction {extraction_id} not found")

        result = await extraction_agent.extract(
            file_path=file_path,
            instructions=extraction.extraction_instructions,
            schema=extraction.extraction_schema,
        )

        document_id = Path(file_path).name
        stored = await self.results_service.insert_result(
            extraction_id=extraction_id,
            document_id=document_id,
            document_type=result.document_type,
            confidence=result.confidence,
            extracted_data=result.extracted_data,
            org_id=extraction.organization_id,
        )

        if not extraction.extraction_schema and result.extracted_data:
            schema = _infer_schema(result.extracted_data)
            await self.update(extraction_id, {"extraction_schema": schema})

        count = await self.results_service.count(extraction_id)
        await self.update(
            extraction_id,
            {
                "processed_documents": count,
                "total_documents": count,
                "status": ExtractionStatus.ACTIVE,
            },
        )
        return stored

    async def reindex(self, extraction_id: str, file_paths: list[str]) -> None:
        """Delete all results and reprocess all documents."""
        await self.results_service.delete_by_extraction_id(extraction_id)
        await self.update(
            extraction_id,
            {"extraction_schema": None, "processed_documents": 0, "total_documents": 0},
        )
        await self.process_documents(extraction_id, file_paths)

    async def get_records(self, extraction_id: str, org_id: Optional[str] = None) -> list[dict[str, Any]]:
        results = await self.results_service.get_results(extraction_id, org_id=org_id)
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
