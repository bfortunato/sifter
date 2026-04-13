---
title: Vision
status: synced
---

# Vision

Sifter is an open-source AI-powered document extraction engine that turns unstructured documents — invoices, contracts, receipts, reports — into a structured, queryable database.

## Problem

Organizations accumulate large volumes of documents whose data is locked in unstructured form. Extracting structured information from these documents is manual, slow, and error-prone. Existing tools either require rigid templates or are too expensive for small teams.

## Solution

Sifter bridges document intelligence and data analytics. Users define what they want to extract in plain language, upload documents, and instantly get a structured table they can query, aggregate, and export. No templates, no training data, no per-page fees.

## Core Value Propositions

- **Zero-config extraction**: Define extraction rules in natural language; schema is inferred automatically from the first processed document
- **Multi-document pipelines**: Organize documents into folders linked to one or more extractors — every upload is processed automatically
- **Queryable results**: Run ad-hoc natural language queries and save named aggregations backed by MongoDB pipelines
- **Conversational Q&A**: Chat with your extracted data; the AI writes and executes queries on your behalf
- **Multi-tenant by default**: Everything is scoped to an organization; teams share extractors, folders, and results securely
- **Open and self-hostable**: No vendor lock-in; bring your own LLM API key; runs on any server with MongoDB

## Long-term Direction

Sifter aims to become the standard self-hosted backend for document intelligence workflows — usable standalone via the web UI, embeddable in custom applications via the REST API or Python SDK, and extensible through pluggable extraction agents.
