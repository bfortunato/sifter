---
title: Cloud Extension Architecture
status: synced
---

# Cloud Extension Architecture

## Overview

Sifter uses an **open-core model**:

- **`sifter`** (public, Apache-2.0) — the core extraction engine + React UI + Python SDK. No billing, no usage limits, single-tenant.
- **`sifter-cloud`** (private) — a backend-only extension. Extends `sifter-server` with billing, subscriptions, usage metering, team invitations, and multi-tenant auth.

---

## Extension Pattern

`sifter-cloud` does not fork the OSS code. It imports and extends:

```python
# sifter-cloud/code/backend/sifter_cloud/main.py
from sifter.server import app          # the OSS FastAPI app

from .api import billing, admin, invites, limits
app.include_router(billing.router)
app.include_router(admin.router)
app.include_router(invites.router)
app.include_router(limits.router)

# Override OSS extension points
app.dependency_overrides[get_usage_limiter] = lambda: StripeLimiter()
app.dependency_overrides[get_email_sender]  = lambda: ResendEmailSender()
app.dependency_overrides[get_current_principal] = get_cloud_principal
```

In production, the backend also serves the built React frontend via FastAPI `StaticFiles`.

---

## OSS Extension Points

### `UsageLimiter` (`sifter/services/limits.py`)

```python
class UsageLimiter(Protocol):
    async def check_upload(self, org_id: str, file_size_bytes: int) -> None: ...
    async def check_sift_create(self, org_id: str) -> None: ...
    async def record_processed(self, org_id: str, doc_count: int) -> None: ...
```

Default: `NoopLimiter` (always allows, records nothing). Dependency: `get_usage_limiter()`.

### `EmailSender` (`sifter/services/email.py`)

```python
class EmailSender(Protocol):
    async def send_invite(self, to: str, org_name: str, invite_url: str) -> None: ...
    async def send_password_reset(self, to: str, reset_url: str) -> None: ...
    async def send_usage_alert(self, to: str, org_name: str, usage_pct: float) -> None: ...
```

Default: `NoopEmailSender` (silently drops all emails). Dependency: `get_email_sender()`.

---

## sifter-cloud Repository Structure

```
sifter-cloud/
├── code/
│   └── backend/                ← Python cloud extension
│       ├── pyproject.toml      # depends on sifter-server>=0.1.0
│       ├── sifter_cloud/
│       │   ├── main.py         # imports OSS app, mounts routers
│       │   ├── auth.py         # CloudPrincipal (org_id + user_id), get_cloud_principal
│       │   ├── config.py       # SIFTER_CLOUD_ prefix env vars
│       │   ├── api/
│       │   │   ├── billing.py  # Stripe webhook, portal, subscription
│       │   │   ├── admin.py    # tenant list, usage (superadmin)
│       │   │   ├── invites.py  # org email invitations
│       │   │   ├── limits.py   # usage quota endpoint
│       │   │   └── config.py   # overrides GET /api/config → { "mode": "cloud" }
│       │   ├── services/
│       │   │   ├── billing_service.py  # Stripe API integration
│       │   │   ├── email_service.py    # Resend transactional email
│       │   │   ├── metering_service.py # per-org usage aggregation
│       │   │   └── limits_service.py   # plan enforcement (StripeLimiter)
│       │   └── models/
│       │       ├── subscription.py     # Plan, PLAN_LIMITS, Subscription
│       │       ├── usage.py            # UsageRecord, UsageSummary
│       │       └── invite.py           # Invite
│       └── tests/
├── Dockerfile                  ← multi-stage: OSS frontend build + Python API
└── docker-compose.cloud.yml
```

The frontend lives in the OSS repo (`sifter/code/frontend/`). The cloud Dockerfile builds it from the OSS source and packages it with the cloud backend. The OSS `StaticFiles` mount in `sifter/server.py` then serves the built frontend.

---

## Cloud Auth

`sifter-cloud` extends the OSS `Principal` with org context:

```python
@dataclass
class CloudPrincipal(Principal):
    org_id: str
    user_id: str
```

The JWT payload includes `org_id`: `{ "sub": user_id, "org_id": org_id, "exp": ... }`.

`get_cloud_principal()` overrides `get_current_principal()` and returns a `CloudPrincipal`.

---

## Additional MongoDB Collections (Cloud Only)

| Collection | Purpose |
|------------|---------|
| `subscriptions` | One per org. Plan, status, Stripe IDs, period end |
| `usage_records` | Daily usage counters per org (docs processed, storage bytes) |
| `invites` | Pending email invitations (token, org_id, expires_at, accepted) |
| `organizations` | Org metadata (name, owner) |

---

## Subscription Plans

| Plan | Docs/month | Storage | Sifts | Price |
|------|------------|---------|-------|-------|
| Free | 50 | 500 MB | 3 | $0 |
| Starter | 500 | 5 GB | 10 | $29/mo |
| Pro | 5,000 | 50 GB | Unlimited | $99/mo |
| Enterprise | Unlimited | Unlimited | Unlimited | Custom |

---

## Cloud-Only API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/billing/subscription` | Current plan + usage summary |
| `POST` | `/api/billing/portal` | Stripe customer portal URL |
| `POST` | `/api/billing/webhook` | Stripe webhook receiver |
| `GET` | `/api/usage` | Usage quota for current org |
| `POST` | `/api/invites` | Send email invite |
| `POST` | `/api/invites/accept` | Accept invitation by token |
| `GET` | `/api/invites` | List pending invites |
| `DELETE` | `/api/invites/{id}` | Revoke invite |
| `GET` | `/api/admin/orgs` | List all orgs (superadmin) |
| `GET` | `/api/admin/orgs/{org_id}/usage` | Org usage detail (superadmin) |
| `GET` | `/api/admin/usage` | All-org usage report (superadmin) |

---

## Feature Matrix

| Feature | OSS (`sifter-ai`) | Cloud (`sifter-cloud`) |
|---------|-------------------|------------------------|
| Document extraction | ✓ | ✓ |
| Folders & sifts | ✓ | ✓ |
| Chat & query | ✓ | ✓ |
| Python SDK | ✓ | ✓ |
| Webhooks | ✓ | ✓ |
| Auth (API keys + JWT) | ✓ | ✓ |
| Storage backends (FS/S3/GCS) | ✓ | ✓ |
| React UI | ✓ | ✓ |
| Multi-tenant orgs | — | ✓ |
| Usage limits | — | ✓ |
| Billing / subscriptions | — | ✓ |
| Email (invites, alerts) | — | ✓ |
| Admin dashboard | — | ✓ |
