---
title: Authentication & API Keys
status: synced
---

# Authentication & API Keys

> **OSS scope:** Sifter OSS is single-tenant. There are no organizations or org switching in the OSS. Multi-tenancy, org management, and team invites are cloud-only features (see `system/cloud.md`).

## User Registration & Login

1. User registers with email, password, and optional full name
2. On success, a JWT token is returned (valid for 24 hours by default)
3. Login with email + password returns a new JWT token

## Auth Mechanisms

Three credential types are accepted on all protected endpoints, in priority order:

| Priority | Mechanism | How |
|----------|-----------|-----|
| 1 | Bootstrap API key | `X-API-Key: <SIFTER_API_KEY config value>` |
| 2 | DB API key | `X-API-Key: sk-...` (key created via `/api/keys`) |
| 3 | JWT Bearer | `Authorization: Bearer <token>` |

If none are present and `SIFTER_REQUIRE_API_KEY=false` (default), the request proceeds as `anonymous`. Set `SIFTER_REQUIRE_API_KEY=true` in production to require auth on every endpoint.

An invalid key (present but unrecognized) always returns HTTP 401.

## API Keys

API keys are used for machine-to-machine access (SDK, integrations, CI):

- Created and managed from the Settings page or via `POST /api/keys`
- Format: `sk-<48 random URL-safe chars>` (~50 chars total)
- Full key is shown **once** at creation and never stored — only SHA-256(key_without_prefix) is kept
- Display shows only the key prefix (first 12 chars, e.g. `sk-AbCdEfGh...`) + creation date
- Keys can be individually revoked (`is_active=false`); revoked keys are excluded from list

## JWT Configuration

- Algorithm: HS256
- Secret: `SIFTER_JWT_SECRET` env var (default: dev value, logs a warning if unchanged)
- Expiry: `SIFTER_JWT_EXPIRE_MINUTES` (default: 1440 = 24h)
- Payload: `{ "sub": user_id, "exp": ... }`

## Frontend Pages

- **Login** (`/login`) — email + password form; link to register
- **Register** (`/register`) — full name, email, password form; auto-login on success
- **Settings** (`/settings`) — API Keys section: list keys (name, masked prefix, created date, revoke button); "Create API Key" button opens dialog that shows full key once with copy button
