# REST API Reference

All endpoints require authentication via:

- `Authorization: Bearer <jwt>` header, OR
- `X-API-Key: <key>` header

Base URL: `http://localhost:8000` (or your server URL)

## Auth

### POST /api/auth/register

Create a new user account.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email address |
| password | string | Yes | User password |
| name | string | | Display name |

**Response:** User object with JWT token

### POST /api/auth/login

Authenticate and receive a JWT token.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email address |
| password | string | Yes | User password |

**Response:** `{ "access_token": "...", "token_type": "bearer" }`

### GET /api/auth/me

Return the currently authenticated user.

**Response:** User object

## Sifts

### GET /api/sifts

List all sifts for the authenticated user.

**Response:** Array of sift objects

### POST /api/sifts

Create a new sift.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Sift name |
| instructions | string | Yes | What to extract (natural language) |
| description | string | | Optional description |

**Response:** Sift object

### GET /api/sifts/:id

Get a sift by ID.

**Response:** Sift object

### PATCH /api/sifts/:id

Update a sift's name, instructions, or description.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | | New sift name |
| instructions | string | | New extraction instructions |
| description | string | | New description |

**Response:** Updated sift object

### DELETE /api/sifts/:id

Delete a sift and all its records.

**Response:** `204 No Content`

### POST /api/sifts/:id/upload

Upload one or more documents to a sift for processing.

**Request:** `multipart/form-data` with one or more `files` fields.

**Response:** Array of created document objects

### POST /api/sifts/:id/reindex

Reprocess all documents in the sift from scratch.

**Response:** `202 Accepted`

### POST /api/sifts/:id/reset

Clear all extracted records from the sift (keeps documents).

**Response:** `204 No Content`

### GET /api/sifts/:id/records

Get all extracted records for a sift.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| limit | integer | Max records to return (default: 100) |
| skip | integer | Records to skip for pagination |

**Response:** Array of record objects

### GET /api/sifts/:id/records/csv

Export all records as a CSV file download.

**Response:** `text/csv` file attachment

### POST /api/sifts/:id/query

Run a natural language query against the sift's records.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | Natural language query (e.g. "Total by client") |

**Response:** Query results as structured data

### POST /api/sifts/:id/chat

Chat with the sift's data in natural language.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| message | string | Yes | User message |
| history | array | | Previous messages for context |

**Response:** AI-generated conversational response

## Folders

### GET /api/folders

List all folders for the authenticated user.

**Response:** Array of folder objects

### POST /api/folders

Create a new folder.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Folder name |

**Response:** Folder object

### GET /api/folders/:id

Get a folder by ID.

**Response:** Folder object

### PATCH /api/folders/:id

Rename a folder.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | New folder name |

**Response:** Updated folder object

### DELETE /api/folders/:id

Delete a folder and remove all document associations.

**Response:** `204 No Content`

### GET /api/folders/:id/sifts

List all sifts linked to a folder.

**Response:** Array of sift objects

### POST /api/folders/:id/sifts

Link a sift to a folder. All existing folder documents will be queued for processing by the sift.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sift_id | string | Yes | ID of the sift to link |

**Response:** `201 Created`

### DELETE /api/folders/:id/sifts/:sift_id

Unlink a sift from a folder.

**Response:** `204 No Content`

### GET /api/folders/:id/documents

List all documents in a folder.

**Response:** Array of document objects with per-sift processing status

### POST /api/folders/:id/documents

Upload one or more documents to a folder. All linked sifts will process each document automatically.

**Request:** `multipart/form-data` with one or more `files` fields.

**Response:** Array of created document objects

## Documents

### GET /api/documents/:id

Get a document by ID, including per-sift processing status.

**Response:** Document object

### DELETE /api/documents/:id

Delete a document and all associated records.

**Response:** `204 No Content`

### POST /api/documents/:id/reprocess

Re-queue a document for processing by all linked sifts (or a specific sift).

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| sift_id | string | Reprocess for a specific sift only |

**Response:** `202 Accepted`

## Webhooks

### GET /api/webhooks

List all registered webhooks.

**Response:** Array of webhook objects

### POST /api/webhooks

Register a new webhook.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| events | string or array | Yes | Event name(s) or wildcard pattern |
| url | string | Yes | HTTPS URL to POST events to |
| sift_id | string | | Filter to events for a specific sift |

**Response:** Webhook object

### DELETE /api/webhooks/:id

Delete a registered webhook.

**Response:** `204 No Content`

## Aggregations

### GET /api/aggregations

List all aggregations for the authenticated user.

**Response:** Array of aggregation objects

### POST /api/aggregations

Create a new named aggregation from a natural language query.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sift_id | string | Yes | ID of the sift to query |
| name | string | Yes | Human-readable name |
| query | string | Yes | Natural language query |

**Response:** Aggregation object

### GET /api/aggregations/:id

Get an aggregation by ID.

**Response:** Aggregation object

### GET /api/aggregations/:id/result

Run the aggregation pipeline and return results.

**Response:** Array of result documents

### POST /api/aggregations/:id/regenerate

Regenerate the aggregation pipeline from its natural language query (useful when the sift schema changes).

**Response:** Updated aggregation object

### DELETE /api/aggregations/:id

Delete an aggregation.

**Response:** `204 No Content`
