---
title: Users
status: synced
---

# Users

## Primary Persona: Business User

**Who**: A professional at an SME — operations, finance, legal, procurement — dealing with high volumes of repetitive documents. Semi-technical at most; will not self-host. Uses Sifter via the cloud App.

**Goal**: Turn a pile of PDFs into a clean, shareable table without writing code or paying per-page enterprise SaaS fees.

**Behavior**:
- Creates a sift with plain-language instructions ("extract client, date, total amount")
- Uploads documents via folders (bulk or one-by-one)
- Reviews the structured table, filters and sorts, exports to CSV
- Uses natural language query or aggregations for ad-hoc analysis
- Shares workspace access with colleagues in the same organization

**Pain points solved**: No more copy-pasting from PDFs; no more broken Excel macros; no more per-seat SaaS invoices.

**Entry**: Sifter App (cloud, signup). Chat is a secondary tool — useful for ad-hoc questions about the dataset, but the primary workflow is table → filter → export.

---

## Secondary Persona: Developer

**Who**: A software developer or technical founder building a product or internal tool that needs to ingest and process documents. May also set up Sifter for a non-technical team.

**Goal**: Embed document extraction into a larger system via API, SDK, or MCP — without managing an LLM integration, PDF parsing, or a result storage layer.

**Behavior**:
- Authenticates via API key and calls the REST API or Python SDK
- Creates extractors and uploads documents programmatically
- Polls extraction status and retrieves results in JSON
- Hooks into the MCP server from Claude Desktop, Cursor, or an AI agent
- May self-host Sifter inside a private VPC if data residency or cost at scale requires it

**Pain points solved**: No custom LLM prompts, no PDF parsing code, no result storage layer — Sifter handles all of that. MCP gives AI agents direct read access to extracted records.

**Entry**: Cloud API key (default). Self-hosted OSS for specific requirements.

---

## Tertiary Target: Enterprise Buyer

Not a day-to-day user persona — a procurement or IT decision-maker evaluating Sifter for organization-wide deployment with compliance requirements.

**Needs**: SSO (SAML/SCIM), audit log, RBAC, BYOK LLM (e.g. Azure OpenAI with their key), on-premises or dedicated cloud deployment, data retention policies, custom SLA.

**Entry**: `/enterprise` contact form on the website → sales conversation → dedicated deployment or on-prem.

These features are on the roadmap (Phase 5) but are not part of the standard cloud product. They are delivered as custom engagements.
