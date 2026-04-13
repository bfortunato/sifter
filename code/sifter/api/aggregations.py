import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_db
from ..models.aggregation import Aggregation
from ..services.aggregation_service import AggregationService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/aggregations", tags=["aggregations"])


def _get_service() -> AggregationService:
    return AggregationService(get_db())


class CreateAggregationRequest(BaseModel):
    name: str
    description: str = ""
    extraction_id: str
    aggregation_query: str


@router.post("", response_model=dict)
async def create_aggregation(body: CreateAggregationRequest):
    svc = _get_service()
    await svc.ensure_indexes()
    aggregation = await svc.create(
        name=body.name,
        description=body.description,
        extraction_id=body.extraction_id,
        query=body.aggregation_query,
    )
    return _agg_to_dict(aggregation)


@router.get("", response_model=list[dict])
async def list_aggregations(extraction_id: str | None = None):
    svc = _get_service()
    aggregations = await svc.list_all(extraction_id=extraction_id)
    return [_agg_to_dict(a) for a in aggregations]


@router.get("/{agg_id}", response_model=dict)
async def get_aggregation(agg_id: str):
    svc = _get_service()
    aggregation = await svc.get(agg_id)
    if not aggregation:
        raise HTTPException(status_code=404, detail="Aggregation not found")
    return _agg_to_dict(aggregation)


@router.get("/{agg_id}/result")
async def get_aggregation_result(agg_id: str):
    svc = _get_service()
    aggregation = await svc.get(agg_id)
    if not aggregation:
        raise HTTPException(status_code=404, detail="Aggregation not found")
    try:
        results = await svc.execute(agg_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("aggregation_execute_error", agg_id=agg_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    return {"results": results}


@router.delete("/{agg_id}")
async def delete_aggregation(agg_id: str):
    svc = _get_service()
    deleted = await svc.delete(agg_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Aggregation not found")
    return {"deleted": True}


def _agg_to_dict(a: Aggregation) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "description": a.description,
        "extraction_id": a.extraction_id,
        "aggregation_query": a.aggregation_query,
        "aggregation_pipeline": a.aggregation_pipeline,
        "aggregation_error": a.aggregation_error,
        "status": a.status,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }
