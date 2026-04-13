from datetime import datetime, timezone
from typing import Any, Optional

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.aggregation import Aggregation, AggregationStatus
from . import pipeline_agent
from .extraction_results import ExtractionResultsService

logger = structlog.get_logger()

COLLECTION = "aggregations"


class AggregationService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db[COLLECTION]
        self.results_service = ExtractionResultsService(db)

    async def ensure_indexes(self):
        await self.col.create_index("extraction_id", name="extraction_id_idx")
        await self.col.create_index("created_at", name="created_at_idx")

    async def create(
        self,
        name: str,
        description: str,
        extraction_id: str,
        query: str,
    ) -> Aggregation:
        aggregation = Aggregation(
            name=name,
            description=description,
            extraction_id=extraction_id,
            aggregation_query=query,
            status=AggregationStatus.GENERATING,
        )
        doc = aggregation.to_mongo()
        result = await self.col.insert_one(doc)
        aggregation.id = str(result.inserted_id)

        # Generate pipeline in background (fire and forget with update)
        try:
            await self._generate_and_store_pipeline(aggregation.id, extraction_id, query)
        except Exception as e:
            logger.error("pipeline_generation_failed", agg_id=aggregation.id, error=str(e))
            await self._update(
                aggregation.id,
                {"status": AggregationStatus.ERROR, "aggregation_error": str(e)},
            )

        return await self.get(aggregation.id)

    async def _generate_and_store_pipeline(
        self, agg_id: str, extraction_id: str, query: str
    ) -> None:
        samples = await self.results_service.get_sample_records(extraction_id, limit=10)
        pipeline_json = await pipeline_agent.generate_pipeline(query, samples)
        await self._update(
            agg_id,
            {
                "aggregation_pipeline": pipeline_json,
                "status": AggregationStatus.ACTIVE,
                "aggregation_error": None,
            },
        )

    async def get(self, agg_id: str) -> Optional[Aggregation]:
        doc = await self.col.find_one({"_id": ObjectId(agg_id)})
        return Aggregation.from_mongo(doc) if doc else None

    async def list_all(self, extraction_id: Optional[str] = None) -> list[Aggregation]:
        query = {}
        if extraction_id:
            query["extraction_id"] = extraction_id
        cursor = self.col.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=None)
        return [Aggregation.from_mongo(d) for d in docs]

    async def delete(self, agg_id: str) -> bool:
        result = await self.col.delete_one({"_id": ObjectId(agg_id)})
        return result.deleted_count > 0

    async def execute(self, agg_id: str) -> list[dict[str, Any]]:
        aggregation = await self.get(agg_id)
        if not aggregation:
            raise ValueError(f"Aggregation {agg_id} not found")
        if aggregation.status == AggregationStatus.ERROR:
            raise ValueError(f"Aggregation in error state: {aggregation.aggregation_error}")
        if not aggregation.aggregation_pipeline:
            raise ValueError("Aggregation pipeline not yet generated")

        return await self.results_service.execute_aggregation(
            aggregation.extraction_id,
            aggregation.aggregation_pipeline,
        )

    async def live_query(
        self, extraction_id: str, query: str
    ) -> tuple[list[dict[str, Any]], str]:
        """
        Run a one-off NL query against an extraction's results.
        Returns (results, pipeline_json).
        """
        samples = await self.results_service.get_sample_records(extraction_id, limit=10)
        pipeline_json = await pipeline_agent.generate_pipeline(query, samples)
        results = await self.results_service.execute_aggregation(extraction_id, pipeline_json)
        return results, pipeline_json

    async def _update(self, agg_id: str, updates: dict) -> None:
        updates["updated_at"] = datetime.now(timezone.utc)
        await self.col.update_one({"_id": ObjectId(agg_id)}, {"$set": updates})
