---
title: Cloud Extension Architecture
status: synced
---

# Cloud Extension Architecture

## Overview

Sifter uses an **open-core model**:

- **`sifter`** (public, Apache-2.0) — the core extraction engine. Fully self-hostable. No billing, no usage limits, no email.
- **`sifter-cloud`** (private) — extends the OSS core with commercial features: billing, subscriptions, usage metering, SSO, email, tenant management.

The cloud repo imports `sifter-ai` as a Python package dependency and mounts additional FastAPI routers on top of the existing app.

---

## Extension Pattern

`sifter-cloud` does not fork the OSS code. It imports and extends:

```python
# sifter-cloud/sifter_cloud/main.py
from sifter.main import app          # the OSS FastAPI app
from .api import billing, admin, invites, limits

app.include_router(billing.router)
app.include_router(admin.router)
app.include_router(invites.router)
```

Cloud-specific middleware is added via `app.add_middleware(UsageLimiterMiddleware)`.

FastAPI dependency injection is used to override the no-op OSS implementations:

```python
from sifter.services.limits import NoopLimiter
from sifter_cloud.services.limits import StripeLimiter

app.dependency_overrides[NoopLimiter] = StripeLimiter
```

---

## OSS Extension Points

To keep the extension clean, the OSS repo exposes two protocol interfaces that are no-ops by default:

### `UsageLimiter` (`sifter/services/limits.py`)

```python
class UsageLimiter(Protocol):
    async def check_upload(self, org_id: str, file_size_bytes: int) -> None:
        """Raise HTTPException(402) if org exceeded upload quota."""
    async def check_sift_create(self, org_id: str) -> None:
        """Raise HTTPException(402) if org exceeded sift count limit."""
    async def record_processed(self, org_id: str, doc_count: int) -> None:
        """Record extraction for usage metering."""
```

Default implementation: `NoopLimiter` (always allows, records nothing).

### `EmailSender` (`sifter/services/email.py`)

```python
class EmailSender(Protocol):
    async def send_invite(self, to: str, org_name: str, invite_url: str) -> None: ...
    async def send_password_reset(self, to: str, reset_url: str) -> None: ...
    async def send_usage_alert(self, to: str, org_name: str, usage_pct: float) -> None: ...
```

Default implementation: `NoopEmailSender` (silently drops all emails).

---

## sifter-cloud Repository Structure

```
sifter-cloud/
├── pyproject.toml              ← depends on sifter-ai>=0.1.0
├── Dockerfile                  ← extends OSS image
├── docker-compose.cloud.yml    ← adds Redis, adds env vars
├── sifter_cloud/
│   ├── main.py                 ← imports OSS app, mounts cloud routers
│   ├── api/
│   │   ├── billing.py          ← Stripe webhook, portal, subscription CRUD
│   │   ├── admin.py            ← tenant list, usage dashboard (superadmin only)
│   │   ├── invites.py          ← org email invitations
│   │   └── limits.py          ← usage info endpoint
│   ├── services/
│   │   ├── billing_service.py  ← Stripe API integration
│   │   ├── email_service.py    ← Resend / SendGrid transactional email
│   │   ├── metering_service.py ← per-org counters in MongoDB
│   │   └── limits_service.py  ← plan enforcement logic
│   ├── middleware/
│   │   └── usage_limiter.py   ← FastAPI middleware, intercepts uploads
│   └── models/
│       ├── subscription.py     ← Plan, Subscription, Invoice
│       └── usage.py            ← UsageRecord, UsageSummary
└── tests/
```

---

## Additional MongoDB Collections (Cloud Only)

| Collection | Purpose |
|------------|---------|
| `subscriptions` | One per org. Plan, status, Stripe subscription ID, period end |
| `usage_records` | Daily usage counters per org (docs processed, storage bytes) |
| `invites` | Pending email invitations (token, org_id, role, expires_at) |
| `processing_queue` | Persistent task queue (added in CR-007, lives in OSS) |

---

## Subscription Plans

| Plan | Docs/month | Storage | Sifts | Price |
|------|------------|---------|-------|-------|
| Free | 50 | 500 MB | 3 | $0 |
| Starter | 500 | 5 GB | 10 | $29/mo |
| Pro | 5,000 | 50 GB | Unlimited | $99/mo |
| Enterprise | Unlimited | Unlimited | Unlimited | Custom |

Usage limits are enforced by `StripeLimiter` via `check_upload()` and `check_sift_create()` before each operation.

---

## Cloud-Only API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/billing/usage` | Current period usage for the org |
| `POST` | `/api/billing/portal` | Stripe customer portal redirect URL |
| `POST` | `/api/billing/webhook` | Stripe webhook receiver |
| `POST` | `/api/invites` | Send email invite to join org |
| `GET` | `/api/invites/{token}` | Accept an invitation |
| `GET` | `/api/admin/orgs` | List all orgs (superadmin) |
| `GET` | `/api/admin/usage` | Global usage report (superadmin) |

---

## Deployment

```
[ sifter-cloud container ]
     ↓ imports
[ sifter-ai Python package ]  ←  published to PyPI on each release
     ↓ uses
[ MongoDB Atlas + S3 + Redis ]
```

Cloud runs on a managed infrastructure (e.g., Railway, Render, ECS). Self-hosted users run the OSS `docker-compose.yml` unchanged.

---

## Feature Matrix

| Feature | OSS (self-hosted) | Cloud |
|---------|-------------------|-------|
| Document extraction | ✓ | ✓ |
| Folders & sifts | ✓ | ✓ |
| Chat & query | ✓ | ✓ |
| Python SDK | ✓ | ✓ |
| Webhooks | ✓ | ✓ |
| Multi-user / orgs | ✓ | ✓ |
| API keys | ✓ | ✓ |
| Usage limits | — | ✓ |
| Billing / subscriptions | — | ✓ |
| Email (invites, alerts) | — | ✓ |
| SSO / SAML | — | ✓ (Enterprise) |
| Audit log | — | ✓ |
| GDPR export | — | ✓ |
| Admin dashboard | — | ✓ |
| SLA / support | — | ✓ (paid plans) |
