---
title: Q&A Agents
status: synced
---

# Q&A Agents

Q&A agents provide a conversational assistant tied to a specific extraction. The agent has access to the extraction schema and all extraction records, and answers questions by generating and running MongoDB aggregation pipelines on the fly.

## Per-Extraction Chat

- Endpoint: `POST /api/extractions/{id}/chat`
- Body: `{ "message": str, "history": [{role, content}, ...] }`
- Response: `{ "response": str, "data": [...] | null, "pipeline": [...] | null }`

The agent:
1. Loads the extraction schema and sample records (up to 10) for context
2. Determines whether a MongoDB query is needed to answer the question
3. If yes: generates a pipeline, executes it, receives the data
4. Synthesizes a natural language answer incorporating the data
5. Returns both the answer and the raw data (for table display)

## Conversational Context

- Conversation history is passed by the client with each request (last N messages)
- The agent uses history for follow-up questions ("same but for client X", "sort by amount", etc.)
- Sessions are stateless server-side — the client manages history in memory

## Agent Capabilities

- Answer schema questions ("what fields does this extraction have?")
- Aggregate across records ("total amount per client", "count by month")
- Filter and inspect ("show me invoices over €10,000")
- Compare and rank ("which supplier had the most invoices?")
- Respond conversationally when no data query is needed

## Global Chat

The existing `POST /api/chat` endpoint is a global chat that optionally accepts an `extraction_id`. Internally it delegates to the same `ExtractionQAAgent` service — so behavior is consistent. When no `extraction_id` is provided, the agent works without extraction-specific context.

## Frontend

The "Chat" tab on the Extraction Detail page uses `POST /api/extractions/{id}/chat` instead of the global endpoint, providing schema-aware responses.

When an assistant message includes a pipeline, a "View pipeline" toggle shows the generated MongoDB pipeline JSON below the message.
