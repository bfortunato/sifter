import json
import re
from pathlib import Path
from typing import Optional

import litellm
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import config
from ..db import get_db
from ..services.aggregation_service import AggregationService
from ..services.extraction_service import ExtractionService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/chat", tags=["chat"])

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "chat_agent.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8")


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    extraction_id: Optional[str] = None
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    response: str
    data: Optional[list[dict]] = None
    query: Optional[str] = None


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest):
    db = get_db()
    extraction_svc = ExtractionService(db)
    agg_svc = AggregationService(db)

    # Build context about available extractions
    extraction_context = ""
    if body.extraction_id:
        extraction = await extraction_svc.get(body.extraction_id)
        if extraction:
            extraction_context = (
                f"\n## Current Extraction\n"
                f"Name: {extraction.name}\n"
                f"Instructions: {extraction.extraction_instructions}\n"
                f"Schema: {extraction.extraction_schema or 'not yet inferred'}\n"
                f"Documents processed: {extraction.processed_documents}\n"
            )
    else:
        extractions = await extraction_svc.list_all()
        if extractions:
            names = ", ".join(f'"{e.name}" (id: {e.id})' for e in extractions[:5])
            extraction_context = f"\n## Available Extractions\n{names}\n"

    system = _SYSTEM_PROMPT + extraction_context

    # Build message history
    messages = [{"role": "system", "content": system}]
    for msg in body.history[-10:]:  # keep last 10 messages for context
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    response = await litellm.acompletion(
        model=config.pipeline_model,
        messages=messages,
        temperature=0.3,
        api_key=config.llm_api_key or None,
    )

    raw = response.choices[0].message.content

    # Try to parse structured response
    try:
        cleaned = _strip_markdown_fences(raw)
        data = json.loads(cleaned)
        response_text = data.get("response", raw)
        result_data = data.get("data")
        query_used = data.get("query")

        # If the agent returned a query, actually execute it
        if query_used and body.extraction_id:
            try:
                results, _ = await agg_svc.live_query(body.extraction_id, query_used)
                result_data = results
            except Exception as e:
                logger.warning("chat_query_execution_failed", error=str(e))

        return ChatResponse(response=response_text, data=result_data, query=query_used)
    except (json.JSONDecodeError, AttributeError):
        # Plain text response
        return ChatResponse(response=raw)


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()
