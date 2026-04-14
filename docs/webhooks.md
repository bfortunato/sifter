# Webhooks

Webhooks let you receive real-time HTTP POST notifications when events occur in Sifter — without polling. When an event fires, Sifter sends a JSON payload to your registered URL.

## Registering a Webhook

### Via SDK

```python
from sifter import Sifter

s = Sifter(api_key="sk-...")

# Listen to a single event
s.register_hook(
    events="sift.document.processed",
    url="https://my-app.com/webhook",
    sift_id=sift.id,  # optional: filter to a specific sift
)

# Listen to multiple events
s.register_hook(
    events=["sift.document.processed", "sift.error"],
    url="https://my-app.com/webhook",
)

# Wildcard — all sift-level events
s.register_hook(
    events="sift.*",
    url="https://my-app.com/webhook",
)

# Wildcard — every event
s.register_hook(
    events="*",
    url="https://my-app.com/webhook",
)
```

### Via REST API

```http
POST /api/webhooks
Content-Type: application/json
X-API-Key: sk-...

{
  "events": "sift.document.processed",
  "url": "https://my-app.com/webhook",
  "sift_id": "optional-sift-id"
}
```

## Event Types

| Event | When it fires |
|-------|--------------|
| `sift.document.processed` | A document was successfully extracted by a sift |
| `sift.completed` | All pending documents in a sift finished processing |
| `sift.error` | Extraction failed for a document |
| `folder.document.uploaded` | A new document was added to a folder |

## Wildcard Pattern Rules

- `*` — matches any **single** segment separated by `.`
  - `sift.*` matches `sift.completed`, `sift.error` but **not** `folder.document.uploaded`
  - `sift.document.*` matches `sift.document.processed` but **not** `sift.completed`
- `**` — matches **any number** of segments
  - `**` matches everything

Matching is evaluated **server-side** for webhooks (and client-side for SDK event callbacks).

## Webhook Payload

Sifter sends a `POST` request with `Content-Type: application/json`:

```json
{
  "event": "sift.document.processed",
  "timestamp": "2024-03-15T14:23:01Z",
  "sift_id": "sft_abc123",
  "document_id": "doc_xyz789",
  "data": {
    "document": {
      "id": "doc_xyz789",
      "filename": "invoice-q1.pdf",
      "status": "done"
    },
    "record": {
      "client_name": "Acme Corp",
      "invoice_date": "2024-03-01",
      "total_amount": 4250.00,
      "vat_number": "GB123456789"
    }
  }
}
```

## Listing and Deleting Hooks

```python
# List all registered webhooks
hooks = s.list_hooks()
for hook in hooks:
    print(hook["id"], hook["events"], hook["url"])

# Delete a specific hook
s.delete_hook("hook_id")
```

## Example: Receiving Webhooks in FastAPI

```python
from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/webhook")
async def receive_webhook(request: Request):
    payload = await request.json()

    event = payload["event"]
    data = payload["data"]

    if event == "sift.document.processed":
        record = data["record"]
        print(f"New record: {record}")

    elif event == "sift.error":
        doc = data["document"]
        print(f"Error processing {doc['filename']}")

    return {"ok": True}
```

::: tip Production tip
Use HTTPS for your webhook URL and verify requests using a shared secret header or HMAC signature if your integration is sensitive.
:::
