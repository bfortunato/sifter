---
title: Frontend Architecture
status: synced
---

# Frontend Architecture

React 18 + Vite + TypeScript + shadcn/ui admin UI.

## Auth

- JWT stored in `localStorage` under key `sifter_token`
- All API calls use `apiFetch` (from `src/lib/apiFetch.ts`) which injects `Authorization: Bearer <token>` automatically
- On 401: `apiFetch` clears the token and dispatches `sifter:auth-expired` custom event
- `AuthContext` listens to that event, clears state, navigates to `/login`
- `ProtectedRoute` component wraps all authenticated routes — redirects to `/login` if no token

## Pages

### Landing Page (`/`) — unauthenticated

Public marketing page. Shown when no JWT is present.

- Navbar: logo + links (Docs, GitHub, Sign in, Get Started)
- Hero: headline, subtitle, SDK one-liner code block, two CTA buttons (Get Started → `/register`, View Docs)
- Features: 3 cards (Sifts, Folders, Chat & Query)
- How it works: 3-step horizontal flow
- Quick start Python SDK snippet
- Footer: GitHub, Docs, MIT license

When authenticated, `/` shows the Sifts List (see below).

### Login (`/login`) — unauthenticated

- Email + password form
- Calls `login()` from AuthContext; on success navigates to `/`
- Link to Register page

### Register (`/register`) — unauthenticated

- Full name, email, password form
- On success: stores JWT, navigates to `/`

### Sifts List (`/`) — protected

- shadcn `Table`: Name, Status (Badge), Documents count, Created date
- "New Sift" Button → Dialog with form (name, description, instructions)
- Click row → navigate to `/sifts/:id`

### Sift Detail (`/sifts/:id`) — protected

- Card header: name, description, instructions, inferred schema
- Action buttons: Upload More, Reindex, Export CSV, Delete
- Progress bar during indexing (polled via React Query `refetchInterval`)
- Tabs: **Records** | **Query** | **Chat**
  - **Records**: dynamic Table from `extracted_data` keys
  - **Query** (Aggregation Panel):
    - Top: named aggregations list — status badge (spinner=generating, ✓=ready, ✗=error), last ran time, Run/Regenerate/Delete buttons; "New Aggregation" dialog
    - Bottom: live ad-hoc query textarea + Run button + results table + collapsible pipeline JSON
  - **Chat**: per-sift Q&A chat using `POST /api/sifts/{id}/chat`; assistant messages with pipeline toggle

### Chat Page (`/chat`) — protected

- Full-page global chat, optional sift dropdown
- ScrollArea for messages
- Inline data tables in responses

### Folders (`/folders`) — protected

- List of folders: name, document count, extractor count, created date
- "New Folder" button

### Folder Detail (`/folders/:id`) — protected

- Linked sifts section: list current links, "Link Sift" dropdown (select from existing sifts), unlink button
- Upload section: file picker + drag-and-drop, upload progress
- Document list: filename, size, upload date, per-sift status badges (pending/processing/done/error)
- Click document row → navigate to `/documents/:id`

### Document Detail (`/documents/:id`) — protected

- Metadata: filename, size, content type, uploaded at
- Per-sift tabs: status badge, extracted_data table with confidence, "Reprocess" button

### Settings (`/settings`) — protected

- **API Keys section**: list keys (prefix + created date), "Create Key" button → dialog shows full `sk-...` key once, copy button, revoke button per key
- **Organization section**: shows current user email; org management is a cloud feature

## Architecture Principles

- `src/lib/apiFetch.ts` — drop-in for `fetch` with auth injection and 401 handling
- `src/context/AuthContext.tsx` — JWT state, login/register/logout, auth-expired listener
- `src/api/` — one file per resource, all use `apiFetch`
- `src/hooks/` — React Query hooks wrapping every API call
- Components only consume hooks, never call fetch directly
- `useMutation` for writes, `useQuery` with polling for sift/aggregation progress
- TypeScript throughout with proper types
- `ProtectedRoute` wraps all authenticated routes

## shadcn/ui Components Used

Button, Input, Textarea, Table, Card, Badge, Progress, Dialog, DropdownMenu, Tabs, ScrollArea, Skeleton, Alert, Tooltip, Select, Separator
