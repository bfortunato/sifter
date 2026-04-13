---
title: Authentication, Organizations & API Keys
status: synced
---

# Authentication, Organizations & API Keys

Sifter supports multi-tenancy. All resources are scoped to an **Organization**. Users authenticate with JWT (browser login) or API Keys (programmatic access).

## User Registration & Login

1. User registers with email, password, and full name
2. On registration, a personal organization is automatically created (slug derived from email)
3. User receives a JWT token valid for 24 hours
4. Login with email + password returns a new JWT token

## Organizations

- An Organization is the top-level tenant. All extractions, folders, documents, and aggregations belong to an organization.
- Users belong to one or more organizations with a role: `owner`, `admin`, `member`
- Organization owners can invite other users by email
- Users can create additional organizations beyond their personal one
- The JWT token contains `org_id` — the currently active organization
- To switch organizations, call `POST /api/auth/switch-org` which issues a new token

## API Keys

API keys are used for machine-to-machine access (SDK, integrations, automation):
- Created and managed from the Settings page
- Format: `sk-<48 random URL-safe chars>`
- Full key is shown **once** at creation and never stored — only the SHA-256 hash is kept
- Display shows only the key prefix (first 12 chars, e.g. `sk-AbCdEfGh...`) + creation date
- Keys are scoped to the creating user's current organization
- Keys can be individually revoked (soft delete, `is_active=false`)
- Pass as header: `X-API-Key: sk-...`

## Auth Mechanism

Both JWT Bearer tokens and API keys are accepted on all protected endpoints:
- JWT: `Authorization: Bearer <token>` header
- API Key: `X-API-Key: <key>` header
- Returns HTTP 401 if neither is present or both are invalid

## Frontend Pages & Layout

- **Login** (`/login`) — email + password form; link to register
- **Register** (`/register`) — full name, email, password form; auto-login on success
- **Sidebar** (persistent left column, authenticated only):
  - Logo "⬡ Sifter" at top
  - Nav links: Sifts (`/`), Folders (`/folders`), Chat (`/chat`)
  - Bottom: Settings (`/settings`), user email, Logout button
- **Settings** (`/settings`) — two-column layout with left sub-navigation:
  - *Profile*: username, email, member since (read-only)
  - *API Keys*: table of keys (name, masked key, created date, delete); warning callout that keys are shown only once; "Create API Key" button opens dialog that shows full key once
  - *Webhooks*: table of registered webhooks (URL, events pattern, created date, delete); "Register Webhook" button
  - *Organization*: placeholder for future org management settings
- All routes except `/login` and `/register` require authentication — redirect to `/login` on 401
