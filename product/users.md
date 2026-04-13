---
title: Users
status: synced
---

# Users

## Primary Persona: The Data-Driven Operations Manager

**Who**: A non-technical or semi-technical professional at an SME — accounting, operations, legal, or procurement — who deals with high volumes of repetitive documents (invoices, contracts, delivery notes, expense receipts).

**Goal**: Turn a pile of PDFs into a clean spreadsheet or database without writing code or paying for expensive enterprise software.

**Behavior**:
- Creates an extraction with plain-language instructions ("extract client, date, total amount")
- Uploads documents via folders
- Reviews the structured table, exports to CSV, or queries the data with natural language
- Shares the workspace with colleagues in the same organization

**Pain points solved**: No more copy-pasting from PDFs; no more broken Excel macros; no more per-seat SaaS invoices.

---

## Secondary Persona: The Developer / Integrator

**Who**: A software developer building a product or internal tool that needs to ingest and process documents at scale.

**Goal**: Embed Sifter's extraction capabilities into a larger system via the REST API or Python SDK, without managing an LLM integration themselves.

**Behavior**:
- Uses the Python SDK or REST API to create extractors and upload documents programmatically
- Authenticates via API key (`X-API-Key`)
- Polls extraction status and retrieves results in JSON
- May run Sifter self-hosted inside a private VPC

**Pain points solved**: No need to write custom LLM prompts, handle PDF parsing, or build a result storage layer — Sifter handles all of that.

---

## Tertiary Persona: The Analyst

**Who**: A data analyst or BI professional who needs to query and aggregate extracted document data alongside other business data.

**Goal**: Run aggregations, explore trends, and answer ad-hoc questions about document datasets without SQL or MongoDB expertise.

**Behavior**:
- Uses the Query tab (ad-hoc natural language queries) and named aggregations
- Uses the Chat interface to explore data conversationally
- Exports results to CSV for downstream tools (Excel, Tableau, etc.)

**Pain points solved**: Can explore document datasets without knowing MongoDB aggregation pipeline syntax.
