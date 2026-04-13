---
title: Conversational Chat Agent
status: draft
---

# Conversational Chat Agent

A chat interface that lets users ask questions about their extracted data in natural language. The agent determines whether a question is about data, identifies the right extraction, generates a query, and responds with formatted results.

## User Flow

1. User opens Chat page (or the Chat tab on an extraction detail page)
2. User types a question: "How much did I invoice in December?" or "Which suppliers have the highest average amount?"
3. Agent determines if the question is data-related
4. If yes: identifies the relevant extraction (or uses the one in context), generates aggregation pipeline, executes it, and formats results as natural language + optional table
5. If no: responds conversationally

## Key Behaviors

- Chat endpoint: `POST /api/chat` with `{ message, extraction_id? }`
- When `extraction_id` is provided, scope queries to that extraction
- Responses include both natural language text and structured data when relevant
- Streaming responses for better UX
- Follow-up questions maintain context within a session
