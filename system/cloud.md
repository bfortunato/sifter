---
title: Cloud Extension Architecture
status: synced
---

# Cloud Extension Architecture

## Overview

Sifter uses an **open-core model**:

- **`sifter-ai`** (public, Apache-2.0) — the core extraction engine. REST API + Python SDK. No UI, no billing, no usage limits.
- **`sifter-cloud`** (private) — a monorepo with the React frontend + cloud backend. Extends `sifter-ai` with billing, subscriptions, usage metering, team invitations, and multi-tenant auth.

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
├── pyproject.toml              ← depends on sifter-ai>=0.1.0
├── run.sh                      ← dev: MongoDB + API + Vite
├── Dockerfile                  ← multi-stage: Node build + Python API
├── docker-compose.cloud.yml
├── frontend/                   ← React 18 + Vite + Tailwind (the UI)
│   ├── package.json
│   ├── vite.config.ts          ← proxies /api → :8000 in dev
│   └── src/
│       ├── pages/              ← all UI pages (including cloud-only billing, team)
│       ├── api/
│       ├── hooks/
│       └── components/
├── sifter_cloud/
│   ├── main.py                 ← imports OSS app, mounts routers, serves frontend/dist
│   ├── auth.py                 ← CloudPrincipal (org_id + user_id), get_cloud_principal
│   ├── config.py               ← SIFTER_CLOUD_ prefix env vars
│   ├── api/
│   │   ├── billing.py          ← Stripe webhook, portal, subscription
│   │   ├── admin.py            ← tenant list, usage (superadmin)
│   │   ├── invites.py          ← org email invitations
│   │   └── limits.py           ← usage quota endpoint
│   ├── services/
│   │   ├── billing_service.py  ← Stripe API integration
│   │   ├── email_service.py    ← Resend transactional email
│   │   ├── metering_service.py ← per-org usage aggregation
│   │   └── limits_service.py   ← plan enforcement (StripeLimiter)
│   └── models/
│       ├── subscription.py     ← Plan, PLAN_LIMITS, Subscription
│       ├── usage.py            ← UsageRecord, UsageSummary
│       └── invite.py           ← Invite
└── tests/
```

---

## Frontend in sifter-cloud

### Development

Vite runs on `:3000`, proxies `/api` and `/health` to FastAPI on `:8000`:

```ts
// vite.config.ts
server: {
  proxy: {
    "/api": { target: "http://localhost:8000", changeOrigin: true },
  }
}
```

### Production

The Dockerfile multi-stage build:
1. Node stage: `npm ci && npm run build` → `frontend/dist/`
2. Python stage: copies `frontend/dist/` into the image

FastAPI mounts the dist directory if it exists:
```python
if os.path.isdir("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True))
```

One container, one port (`:8000`), serves both API and UI.

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
| React UI | — | ✓ |
| Multi-tenant orgs | — | ✓ |
| Usage limits | — | ✓ |
| Billing / subscriptions | — | ✓ |
| Email (invites, alerts) | — | ✓ |
| Admin dashboard | — | ✓ |
