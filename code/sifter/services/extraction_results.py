import csv
import io
import json
from datetime import datetime, timezone
from typing import Any

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.extraction_result import ExtractionResult

logger = structlog.get_logger()

COLLECTION = "extraction_results"


class ExtractionResultsService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db[COLLECTION]

    async def ensure_indexes(self):
        await self.col.create_index(
            [("extraction_id", 1), ("document_id", 1)],
            unique=True,
            name="extraction_document_unique",
        )
        await self.col.create_index("extraction_id", name="extraction_id_idx")

    async def insert_result(
        self,
        extraction_id: str,
        document_id: str,
        document_type: str,
        confidence: float,
        extracted_data: dict[str, Any],
    ) -> ExtractionResult:
        result = ExtractionResult(
            extraction_id=extraction_id,
            document_id=document_id,
            document_type=document_type,
            confidence=confidence,
            extracted_data=extracted_data,
            created_at=datetime.now(timezone.utc),
        )
        doc = result.to_mongo()
        await self.col.replace_one(
            {"extraction_id": extraction_id, "document_id": document_id},
            doc,
            upsert=True,
        )
        logger.info("result_inserted", extraction_id=extraction_id, document_id=document_id)
        return result

    async def get_results(self, extraction_id: str) -> list[ExtractionResult]:
        cursor = self.col.find({"extraction_id": extraction_id})
        docs = await cursor.to_list(length=None)
        return [ExtractionResult.from_mongo(d) for d in docs]

    async def get_result(self, result_id: str) -> ExtractionResult | None:
        doc = await self.col.find_one({"_id": ObjectId(result_id)})
        return ExtractionResult.from_mongo(doc) if doc else None

    async def delete_by_extraction_id(self, extraction_id: str) -> int:
        result = await self.col.delete_many({"extraction_id": extraction_id})
        logger.info("results_deleted", extraction_id=extraction_id, count=result.deleted_count)
        return result.deleted_count

    async def count(self, extraction_id: str) -> int:
        return await self.col.count_documents({"extraction_id": extraction_id})

    async def execute_aggregation(
        self, extraction_id: str, pipeline_json: str
    ) -> list[dict[str, Any]]:
        """
        Execute a MongoDB aggregation pipeline against extraction results.
        Automatically injects extraction_id match as the first stage.
        """
        pipeline: list[dict] = json.loads(pipeline_json)

        # Inject extraction_id filter as first stage if not present
        has_extraction_match = False
        if pipeline and isinstance(pipeline[0], dict):
            match = pipeline[0].get("$match", {})
            if "extraction_id" in match:
                has_extraction_match = True

        if not has_extraction_match:
            pipeline.insert(0, {"$match": {"extraction_id": extraction_id}})

        logger.info(
            "aggregation_execute",
            extraction_id=extraction_id,
            stages=len(pipeline),
        )

        cursor = self.col.aggregate(pipeline)
        results = await cursor.to_list(length=None)

        # Convert ObjectId values to strings for JSON serialization
        return [_serialize_doc(r) for r in results]

    async def export_csv(self, extraction_id: str) -> str:
        results = await self.get_results(extraction_id)
        if not results:
            return ""

        # Collect all field names across all results
        all_fields: list[str] = []
        seen = set()
        for result in results:
            for key in result.extracted_data:
                if key not in seen:
                    all_fields.append(key)
                    seen.add(key)

        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=["document_id", "document_type", "confidence"] + all_fields,
            extrasaction="ignore",
        )
        writer.writeheader()

        for result in results:
            row = {
                "document_id": result.document_id,
                "document_type": result.document_type,
                "confidence": result.confidence,
                **result.extracted_data,
            }
            writer.writerow(row)

        return output.getvalue()

    async def get_sample_records(
        self, extraction_id: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        cursor = self.col.find({"extraction_id": extraction_id}).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [_serialize_doc(d) for d in docs]


def _serialize_doc(doc: dict) -> dict:
    """Recursively convert non-JSON-serializable types."""
    result = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, dict):
            result[k] = _serialize_doc(v)
        elif isinstance(v, list):
            result[k] = [_serialize_doc(i) if isinstance(i, dict) else i for i in v]
        else:
            result[k] = v
    return result
