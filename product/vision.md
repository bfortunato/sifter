---
title: Vision
status: synced
---

# Vision

Sifter is an open-source AI-powered document extraction engine that turns unstructured documents — invoices, contracts, receipts, reports — into a structured, queryable database.

## Problem

Organizations accumulate large volumes of documents whose data is locked in unstructured form. Extracting structured information is manual, slow, and error-prone. Existing tools either require rigid templates, demand ML expertise, or charge per-page fees that make them impractical for small teams.

## Solution

Sifter bridges document intelligence and data analytics. Users describe what they want in plain language, upload documents, and instantly get a structured table they can query, aggregate, and export — without writing parsing code or managing an LLM integration.

## Product Surfaces

### Sifter App (Cloud)
A hosted web application for business users — operations, finance, legal, procurement — who need to turn document piles into structured data without touching infrastructure. Sign up, upload, query, export. Billing and multi-tenant organization management included.

### Sifter Developer (API + SDK + MCP)
A cloud API and Python SDK for developers who want to embed document extraction into their own products or workflows. Cloud is the default entry point; self-hosting is available via the open-source engine for teams with specific requirements (data residency, cost at scale, private VPC).

### Enterprise (Contact)
On-premises deployment, dedicated cloud, SSO, audit log, RBAC, BYOK LLM, and custom SLA for organizations with compliance or procurement constraints. Not a product tier — reached via contact form.

## Core Value Propositions

- **Zero-config extraction**: Define extraction rules in natural language; schema is inferred automatically
- **Multi-document pipelines**: Organize documents into folders linked to one or more extractors — every upload triggers all linked sifts automatically
- **Queryable results**: Run ad-hoc natural language queries and save named aggregations backed by MongoDB pipelines
- **SDK + MCP**: Full Python SDK and MCP server for integration into AI agents, Claude Desktop, Cursor, and custom applications
- **Web UI included**: Built-in React UI for managing sifts, folders, and results — no separate frontend deployment
- **Open and self-hostable**: Inspect the code, bring your own LLM API key, run on any server with MongoDB

## Long-term Direction

Sifter aims to be the standard backend for document intelligence workflows — usable standalone as a cloud SaaS, embeddable via API or SDK, and accessible to AI agents via MCP. The managed cloud offering (`sifter-cloud`) adds multi-tenant organization management, Stripe billing, and usage metering on top of the same open-source engine.
