# Getting Started

## Prerequisites

- Python 3.10+
- Docker (for MongoDB) or MongoDB 6+ installed locally
- An OpenAI API key (or any LiteLLM-compatible provider)

## Installation

```bash
git clone https://github.com/sifter-ai/sifter.git
cd sifter
cp code/.env.example code/.env   # then edit with your API key
./code/run.sh
```

The server starts at `http://localhost:8000` and the UI at `http://localhost:3000`.

## Configuration

Edit `code/.env`:

```bash
SIFTER_LLM_API_KEY=sk-...        # your OpenAI / Anthropic / etc. key
SIFTER_LLM_MODEL=openai/gpt-4o  # any LiteLLM model string
```

## First Sift — via UI

1. Open `http://localhost:3000` and create an account
2. Click **New Sift** and enter a name and instructions (e.g. `"Extract: client name, invoice date, total amount"`)
3. Go to **Folders**, create a folder, link the sift to it
4. Upload one or more PDF invoices
5. Documents are processed automatically — watch the status badges update
6. Click the sift to see extracted records, query them, or export CSV

## First Sift — via SDK

Install the SDK:

```bash
pip install sifter-ai
```

Get an API key from **Settings → API Keys**, then:

```python
from sifter import Sifter

s = Sifter(api_key="sk-...")  # or set SIFTER_API_KEY env var

# One-liner: create temp sift, upload, wait, return records
records = s.sift("./invoices/", "client, date, total amount, VAT")

for r in records:
    print(r["extracted_data"])
```

## Creating an API Key

1. Log in to Sifter
2. Go to **Settings → API Keys**
3. Click **Create API Key**, enter a name
4. Copy the full key — shown **once only**
5. Use it as `api_key=` or set the `SIFTER_API_KEY` environment variable
