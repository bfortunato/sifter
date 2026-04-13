import asyncio
import json
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
        await self.col.create_index("organization_id", name="organization_id_idx")

    async def create(
        self,
        name: str,
        description: str,
        extraction_id: str,
        query: str,
        org_id: Optional[str] = None,
    ) -> Aggregation:
        aggregation = Aggregation(
            organization_id=org_id,
            name=name,
            description=description,
            extraction_id=extraction_id,
            aggregation_query=query,
            status=AggregationStatus.GENERATING,
        )
        doc = aggregation.to_mongo()
        result = await self.col.insert_one(doc)
        aggregation.id = str(result.inserted_id)

        # Fire-and-forget background pipeline generation
        asyncio.create_task(
            self._generate_and_store_pipeline(aggregation.id, extraction_id, query, org_id)
        )

        return aggregation

    async def _generate_and_store_pipeline(
        self, agg_id: str, extraction_id: str, query: str, org_id: Optional[str] = None
    ) -> None:
        try:
            samples = await self.results_service.get_sample_records(
                extraction_id, limit=10, org_id=org_id
            )
            pipeline_json = await pipeline_agent.generate_pipeline(query, samples)
            # Parse to list for storage
            pipeline_list = json.loads(pipeline_json)
            await self._update(
                agg_id,
                {
                    "pipeline": pipeline_list,
                    "status": AggregationStatus.READY,
                    "aggregation_error": None,
                },
            )
        except Exception as e:
            logger.error("pipeline_generation_failed", agg_id=agg_id, error=str(e))
            await self._update(
                agg_id,
                {"status": AggregationStatus.ERROR, "aggregation_error": str(e)},
            )

    async def get(self, agg_id: str, org_id: Optional[str] = None) -> Optional[Aggregation]:
        query: dict = {"_id": ObjectId(agg_id)}
        if org_id:
            query["organization_id"] = org_id
        doc = await self.col.find_one(query)
        return Aggregation.from_mongo(doc) if doc else None

    async def list_all(
        self,
        extraction_id: Optional[str] = None,
        org_id: Optional[str] = None,
    ) -> list[Aggregation]:
        query: dict = {}
        if extraction_id:
            query["extraction_id"] = extraction_id
        if org_id:
            query["organization_id"] = org_id
        cursor = self.col.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=None)
        return [Aggregation.from_mongo(d) for d in docs]

    async def delete(self, agg_id: str, org_id: Optional[str] = None) -> bool:
        query: dict = {"_id": ObjectId(agg_id)}
        if org_id:
            query["organization_id"] = org_id
        result = await self.col.delete_one(query)
        return result.deleted_count > 0

    async def execute(
        self, agg_id: str, org_id: Optional[str] = None
    ) -> tuple[list[dict[str, Any]], list]:
        """Execute stored pipeline. Returns (results, pipeline_list)."""
        aggregation = await self.get(agg_id, org_id=org_id)
        if not aggregation:
            raise ValueError(f"Aggregation {agg_id} not found")
        if aggregation.status == AggregationStatus.ERROR:
            raise ValueError(f"Aggregation in error state: {aggregation.aggregation_error}")
        if aggregation.status == AggregationStatus.GENERATING:
            raise ValueError("Aggregation pipeline is still being generated")
        if not aggregation.pipeline:
            raise ValueError("Aggregation pipeline not yet generated")

        results = await self.results_service.execute_aggregation(
            aggregation.extraction_id,
            aggregation.pipeline,
            org_id=org_id,
        )

        # Update last_run_at
        await self._update(agg_id, {"last_run_at": datetime.now(timezone.utc)})

        return results, aggregation.pipeline

    async def regenerate(self, agg_id: str, org_id: Optional[str] = None) -> Aggregation:
        """Reset to generating and kick off pipeline re-generation."""
        aggregation = await self.get(agg_id, org_id=org_id)
        if not aggregation:
            raise ValueError(f"Aggregation {agg_id} not found")

        await self._update(
            agg_id,
            {"status": AggregationStatus.GENERATING, "aggregation_error": None, "pipeline": None},
        )

        asyncio.create_task(
            self._generate_and_store_pipeline(
                agg_id, aggregation.extraction_id, aggregation.aggregation_query, org_id
            )
        )

        return await self.get(agg_id, org_id=org_id)

    async def live_query(
        self, extraction_id: str, query: str, org_id: Optional[str] = None
    ) -> tuple[list[dict[str, Any]], list]:
        """
        Run a one-off NL query against an extraction's results.
        Returns (results, pipeline_list).
        """
        samples = await self.results_service.get_sample_records(
            extraction_id, limit=10, org_id=org_id
        )
        pipeline_json = await pipeline_agent.generate_pipeline(query, samples)
        pipeline_list = json.loads(pipeline_json)
        results = await self.results_service.execute_aggregation(
            extraction_id, pipeline_list, org_id=org_id
        )
        return results, pipeline_list

    async def _update(self, agg_id: str, updates: dict) -> None:
        updates["updated_at"] = datetime.now(timezone.utc)
        await self.col.update_one({"_id": ObjectId(agg_id)}, {"$set": updates})
