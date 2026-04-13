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

### Login (`/login`) — unauthenticated
- Email + password form
- Calls `login()` from AuthContext; on success navigates to `/`
- Link to Register page

### Register (`/register`) — unauthenticated
- Full name, email, password form
- On success: stores JWT, navigates to `/`

### Extractions List (`/`) — protected
- shadcn `Table`: Name, Status (Badge), Documents count, Created date
- "New Extraction" Button → Dialog with form (name, description, instructions)
- Click row → navigate to `/extractions/:id`

### Extraction Detail (`/extractions/:id`) — protected
- Card header: name, description, instructions, inferred schema
- Action buttons: Upload More (deprecated), Reindex, Export CSV, Delete
- Progress bar during indexing (polled via React Query `refetchInterval`)
- Tabs: **Records** | **Query** | **Chat**
  - **Records**: dynamic Table from `extracted_data` keys
  - **Query** (Aggregation Panel):
    - Top: named aggregations list — status badge (spinner=generating, ✓=ready, ✗=error), last ran time, Run/Regenerate/Delete buttons; "New Aggregation" dialog
    - Bottom: live ad-hoc query textarea + Run button + results table + collapsible pipeline JSON
  - **Chat**: per-extraction Q&A chat using `POST /api/extractions/{id}/chat`; assistant messages with pipeline toggle

### Chat Page (`/chat`) — protected
- Full-page global chat, optional extraction dropdown
- ScrollArea for messages
- Inline data tables in responses

### Folders (`/folders`) — protected
- List of folders: name, document count, extractor count, created date
- "New Folder" button

### Folder Detail (`/folders/:id`) — protected
- Linked extractors section: list current links, "Link Extractor" dropdown (select from existing extractors), unlink button
- Upload section: file picker + drag-and-drop, upload progress
- Document list: filename, size, upload date, per-extractor status badges (pending/processing/done/error)
- Click document row → navigate to `/documents/:id`

### Document Detail (`/documents/:id`) — protected
- Metadata: filename, size, content type, uploaded by/at
- Per-extractor tabs: status badge, extracted_data table with confidence, "Reprocess" button

### Settings (`/settings`) — protected
- **API Keys section**: list keys (prefix + created date), "Create Key" button → dialog shows full `sk-...` key once, copy button, revoke button per key
- **Organization section**: org name, member list with roles, invite form (email + role dropdown)

## Architecture Principles

- `src/lib/apiFetch.ts` — drop-in for `fetch` with auth injection and 401 handling
- `src/context/AuthContext.tsx` — JWT state, login/register/logout, auth-expired listener
- `src/api/` — one file per resource, all use `apiFetch`
- `src/hooks/` — React Query hooks wrapping every API call
- Components only consume hooks, never call fetch directly
- `useMutation` for writes, `useQuery` with polling for extraction/aggregation progress
- TypeScript throughout with proper types
- `ProtectedRoute` wraps all authenticated routes

## shadcn/ui Components Used

Button, Input, Textarea, Table, Card, Badge, Progress, Dialog, DropdownMenu, Tabs, ScrollArea, Skeleton, Alert, Tooltip, Select, Separator
