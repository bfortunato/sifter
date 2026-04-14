import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Optional

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.sift_result import SiftResult

logger = structlog.get_logger()

COLLECTION = "sift_results"


class SiftResultsService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db[COLLECTION]

    async def ensure_indexes(self):
        await self.col.create_index(
            [("sift_id", 1), ("document_id", 1)],
            unique=True,
            name="sift_document_unique",
        )
        await self.col.create_index("sift_id", name="sift_id_idx")
        await self.col.create_index("organization_id", name="organization_id_idx")

    async def insert_result(
        self,
        sift_id: str,
        document_id: str,
        document_type: str,
        confidence: float,
        extracted_data: dict[str, Any],
        org_id: Optional[str] = None,
    ) -> SiftResult:
        result = SiftResult(
            organization_id=org_id,
            sift_id=sift_id,
            document_id=document_id,
            document_type=document_type,
            confidence=confidence,
            extracted_data=extracted_data,
            created_at=datetime.now(timezone.utc),
        )
        doc = result.to_mongo()
        await self.col.replace_one(
            {"sift_id": sift_id, "document_id": document_id},
            doc,
            upsert=True,
        )
        logger.info("result_inserted", sift_id=sift_id, document_id=document_id)
        return result

    async def get_results(
        self,
        sift_id: str,
        org_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[SiftResult], int]:
        query: dict = {"sift_id": sift_id}
        if org_id:
            query["organization_id"] = org_id
        total = await self.col.count_documents(query)
        cursor = self.col.find(query).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [SiftResult.from_mongo(d) for d in docs], total

    async def get_result(self, result_id: str) -> SiftResult | None:
        doc = await self.col.find_one({"_id": ObjectId(result_id)})
        return SiftResult.from_mongo(doc) if doc else None

    async def delete_by_sift_id(self, sift_id: str) -> int:
        result = await self.col.delete_many({"sift_id": sift_id})
        logger.info("results_deleted", sift_id=sift_id, count=result.deleted_count)
        return result.deleted_count

    async def count(self, sift_id: str) -> int:
        return await self.col.count_documents({"sift_id": sift_id})

    async def execute_aggregation(
        self, sift_id: str, pipeline_input: Any, org_id: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """
        Execute a MongoDB aggregation pipeline against sift results.
        Automatically injects sift_id (and org_id if provided) match as the first stage.
        pipeline_input can be a JSON string or a list.
        """
        if isinstance(pipeline_input, str):
            pipeline: list[dict] = json.loads(pipeline_input)
        else:
            pipeline = list(pipeline_input)

        # Build match filter
        match_filter: dict = {"sift_id": sift_id}
        if org_id:
            match_filter["organization_id"] = org_id

        # Inject filter as first stage if not already present
        has_sift_match = False
        if pipeline and isinstance(pipeline[0], dict):
            match = pipeline[0].get("$match", {})
            if "sift_id" in match:
                has_sift_match = True

        if not has_sift_match:
            pipeline.insert(0, {"$match": match_filter})

        logger.info(
            "aggregation_execute",
            sift_id=sift_id,
            stages=len(pipeline),
        )

        cursor = self.col.aggregate(pipeline)
        results = await cursor.to_list(length=None)

        return [_serialize_doc(r) for r in results]

    async def export_csv(self, sift_id: str, org_id: Optional[str] = None) -> str:
        results, _ = await self.get_results(sift_id, org_id=org_id, skip=0, limit=100_000)
        if not results:
            return ""

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
        self, sift_id: str, limit: int = 10, org_id: Optional[str] = None
    ) -> list[dict[str, Any]]:
        query: dict = {"sift_id": sift_id}
        if org_id:
            query["organization_id"] = org_id
        cursor = self.col.find(query).limit(limit)
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
