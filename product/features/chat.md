---
title: Conversational Chat Agent
status: synced
---

# Conversational Chat Agent

A chat interface that lets users ask questions about their extracted data in natural language. Internally powered by `ExtractionQAAgent` (see `qa-agents.md`).

## User Flow

1. User opens Chat page (or the Chat tab on an extraction detail page)
2. User types a question: "How much did I invoice in December?" or "Which suppliers have the highest average amount?"
3. Agent determines if the question is data-related
4. If yes: identifies the relevant extraction (or uses the one in context), generates aggregation pipeline, executes it, and formats results as natural language + optional table
5. If no: responds conversationally

## Endpoints

- `POST /api/chat` — global chat, optional `extraction_id`; internally delegates to `ExtractionQAAgent`
- `POST /api/extractions/{id}/chat` — scoped to a specific extraction; provides schema-aware responses

Both endpoints:
- Body: `{ "message": str, "extraction_id"?: str, "history"?: [{role, content}] }`
- Response: `{ "response": str, "data"?: list, "pipeline"?: list }`

## Key Behaviors

- When `extraction_id` is provided, the agent loads the extraction schema and sample records for richer context
- Responses include both natural language text and structured data when relevant
- Follow-up questions maintain context within a session (history passed by client)
- Auth required: JWT Bearer or `X-API-Key`. Results scoped to caller's organization.
