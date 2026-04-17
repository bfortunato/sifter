---
title: Technical Roadmap
status: synced
---

# Technical Roadmap

Priority order for getting Sifter to production. Grouped by phase.

---

## Phase 1 — Production Baseline

*Target: safe to deploy, data won't be lost*

- [ ] **MongoDB-backed task queue** — replace `asyncio.Queue` with persistent `processing_queue` collection. Tasks survive restarts. Auto-retry on failure (max 3 attempts).
- [ ] **Rate limiting** — `slowapi` on auth and upload endpoints. 10 req/min on login, 20 req/min on uploads.
- [ ] **Real health check** — `GET /health` verifies DB connectivity, reports queue depth and worker count. Returns HTTP 503 if DB is unreachable.
- [ ] **Pagination** — `limit`/`offset` on all list endpoints. Default limit 50. Frontend pagination controls.
- [ ] **S3-compatible storage** — abstract storage backend. Add `S3Backend` alongside existing `FilesystemBackend`. Activated via `SIFTER_STORAGE_BACKEND=s3`.

---

## Phase 2 — Hardening

*Target: production-grade reliability and security*

- [ ] **Input validation** — Pydantic validators on all request bodies: email format, password strength, URL format (webhooks), file MIME type on upload.
- [ ] **LLM retry logic** — exponential backoff with jitter on `litellm.acompletion()` calls. Max 3 retries on transient errors.
- [ ] **Webhook delivery tracking** — record delivery attempts, response status, and timestamp. Retry failed deliveries up to 3 times with exponential backoff.
- [ ] **Graceful shutdown** — on SIGTERM, stop accepting new tasks, wait up to 30s for in-progress workers to finish before cancelling.
- [ ] **Request tracing** — inject `X-Request-ID` header, propagate through structlog context. Log request path, status, and latency.
- [ ] **Startup validation** — refuse to start if `SIFTER_JWT_SECRET` is the default dev value in non-dev environments.

---

## Phase 3 — Positioning, Docs & MCP (CR-018–021)

*Target: coherent developer story before cloud GA*

- [ ] **Product repositioning** (CR-018) — rewrite `product/vision.md` and `product/users.md` to 2-surface model (App + Developer) with Contact CTA for enterprise.
- [ ] **Docs site → Mintlify** (CR-019) — migrate from VitePress to Mintlify. New sidebar: Overview / Concepts / Integrations / Self-hosting / Resources.
- [ ] **Landing redesign + enterprise page** (CR-020) — update `LandingPage.tsx` to reflect 2 surfaces; add `/enterprise` page with feature list and contact form; add `POST /api/enterprise/contact` backend endpoint.
- [ ] **MCP server v1** (CR-021) — new `sifter-mcp` Python package with read-only tools: `list_sifts`, `get_sift`, `list_records`, `query_sift`, `list_folders`, `get_folder`. Stdio transport. PyPI distribution via `uvx sifter-mcp`.

---

## Phase 4 — Cloud GA (`sifter-cloud` repo)

*Target: public SaaS launch with billing*

- [ ] **Stripe billing** — subscription tiers (Free / Starter / Pro / Enterprise), metered usage, Stripe webhook handler. `StripeLimiter` overrides `UsageLimiter`.
- [ ] **Email sending** — transactional email via Resend: invites, password reset, usage alerts, enterprise lead notifications. `ResendEmailSender` overrides `EmailSender`.
- [ ] **Org invitations** — `POST /api/invites` sends email. Token-based accept flow.
- [ ] **Password reset** — `POST /api/auth/forgot-password` + `POST /api/auth/reset-password`.
- [ ] **Admin dashboard** — internal view of all orgs, usage, subscriptions.
- [ ] **Google / GitHub OAuth** — social login via `authlib` or Stytch.
- [ ] **Usage dashboard** — per-org quota display in the App UI.

---

## Phase 5 — Scalability & Enterprise

*Target: 10k+ documents/month, enterprise compliance*

- [ ] **Distributed workers** — separate worker process/container polling the same `processing_queue`. Multiple instances in parallel.
- [ ] **Indexes audit** — compound indexes for common query patterns. `explain()` tests.
- [ ] **API versioning** — `/api/v1/` prefix. Legacy `/api/` deprecated after one release.
- [ ] **Streaming upload** — chunked upload for files > 50 MB.
- [ ] **SAML / SCIM** — enterprise SSO and user provisioning.
- [ ] **Audit log** — append-only log of all resource mutations (who, what, when).
- [ ] **GDPR tooling** — data export per user, right-to-erasure endpoint.
- [ ] **Data retention policies** — per-org configurable retention with auto-archival.
- [ ] **Custom LLM endpoints** — BYOK Azure OpenAI or any OpenAI-compatible endpoint per org.
- [ ] **Role-based access control** — resource-level permissions (folder-level read/write per user).
- [ ] **Telegram bot** — forward documents to a Sifter folder from a Telegram chat; receive extraction-complete notifications.
- [ ] **MCP v2** — write operations (`create_sift`, `upload_document`), SSE transport for web clients.
