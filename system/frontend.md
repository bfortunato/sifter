---
title: Frontend Architecture
status: draft
---

# Frontend Architecture

React 18 + Vite + TypeScript + shadcn/ui admin UI.

## Pages

### Extractions List (`/`)
- shadcn `Table`: Name, Status (Badge), Documents count, Created date
- "New Extraction" Button → Dialog with form (name, description, instructions)
- Click row → navigate to `/extractions/:id`

### Extraction Detail (`/extractions/:id`)
- Card header: name, description, instructions, inferred schema
- Action buttons: Upload More, Reindex, Export CSV, Delete
- Progress bar during indexing (polled via React Query `refetchInterval`)
- Tabs: **Records** | **Query** | **Chat**
  - Records: dynamic Table from `extracted_data` keys
  - Query: Textarea + "Run Query" button, results in Table below
  - Chat: message list with inline data tables, input at bottom

### Chat Page (`/chat`)
- Full-page chat, optional extraction dropdown
- ScrollArea for messages, streaming responses
- Inline data tables in responses

## Architecture Principles

- `src/api/` — one file per resource with plain fetch functions
- `src/hooks/` — React Query hooks wrapping every API call
- Components only consume hooks, never call fetch directly
- `useMutation` for writes, `useQuery` with polling for extraction progress
- TypeScript throughout with proper types

## shadcn/ui Components Used

Button, Input, Textarea, Table, Card, Badge, Progress, Dialog, DropdownMenu, Tabs, ScrollArea, Skeleton, Alert, Tooltip
