from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class ExtractionResult(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    extraction_id: str
    document_id: str
    document_type: str = "unknown"
    confidence: float = 0.0
    extracted_data: dict[str, Any] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=False, exclude={"id"})
        if self.id:
            d["_id"] = ObjectId(self.id)
        return d

    @classmethod
    def from_mongo(cls, doc: dict) -> "ExtractionResult":
        if doc is None:
            return None
        doc = dict(doc)
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return cls(**doc)
