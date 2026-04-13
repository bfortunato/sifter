from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class AggregationStatus(str, Enum):
    ACTIVE = "active"
    GENERATING = "generating"
    ERROR = "error"


class Aggregation(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    description: str = ""
    extraction_id: str
    aggregation_query: str
    aggregation_pipeline: Optional[str] = None
    aggregation_error: Optional[str] = None
    status: AggregationStatus = AggregationStatus.GENERATING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=False, exclude={"id"})
        if self.id:
            d["_id"] = ObjectId(self.id)
        return d

    @classmethod
    def from_mongo(cls, doc: dict) -> "Aggregation":
        if doc is None:
            return None
        doc = dict(doc)
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return cls(**doc)
