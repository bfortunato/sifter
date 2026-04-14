---
title: Technical Roadmap
status: synced
---

# Technical Roadmap

Priority order for getting Sifter to production. Grouped by phase.

---

## Phase 1 — Production Baseline (CR-007)

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

## Phase 3 — Scalability

*Target: handle 10k+ documents/month, multiple containers*

- [ ] **Distributed workers** — move worker polling to a separate process/container. Multiple worker instances can run in parallel against the same `processing_queue` collection.
- [ ] **Indexes audit** — add missing compound indexes for common query patterns. Add `explain()` tests.
- [ ] **API versioning** — add `/api/v1/` prefix. Legacy `/api/` remains for one release, then deprecated.
- [ ] **Request body size limit** — explicit `Content-Length` limit per endpoint in FastAPI.
- [ ] **Streaming upload** — support chunked upload for files > 50 MB.

---

## Phase 4 — Cloud (CR-008, sifter-cloud repo)

*Target: public SaaS launch*

- [ ] **`UsageLimiter` protocol** — add to OSS as no-op. Cloud implements `StripeLimiter`.
- [ ] **`EmailSender` protocol** — add to OSS as no-op. Cloud implements `ResendEmailSender`.
- [ ] **Stripe billing** — subscription tiers, metered usage, Stripe webhook handler.
- [ ] **Email sending** — transactional email via Resend: invites, password reset, usage alerts.
- [ ] **Org invitations** — `POST /api/invites` sends email. Token-based accept flow.
- [ ] **Password reset** — `POST /api/auth/forgot-password` + `POST /api/auth/reset-password`.
- [ ] **Admin dashboard** — internal view of all orgs, usage, subscriptions.
- [ ] **SSO / OAuth** — Google/GitHub login via `authlib` or Stytch.

---

## Phase 5 — Enterprise

- [ ] **SAML / SCIM** — enterprise SSO and user provisioning.
- [ ] **Audit log** — append-only log of all resource mutations (who, what, when).
- [ ] **GDPR tooling** — data export per user, right-to-erasure endpoint.
- [ ] **Data retention policies** — per-org configurable retention periods with auto-archival.
- [ ] **Custom LLM endpoints** — allow orgs to bring their own LLM endpoint (Azure OpenAI with their key).
- [ ] **Role-based access control** — resource-level permissions (folder-level read/write per user).
