# Sifter — Claude Code Development Prompt

## Context & Vision

You are building **Sifter**, an open-source AI-powered document extraction engine that turns unstructured documents (invoices, contracts, receipts, reports) into a structured, queryable database. Think of it as "the bridge between document intelligence and data analytics."

The tagline is: **"Upload your documents, tell it what you need, get a queryable database."**

Sifter is being extracted and re-engineered from an existing production codebase (a multiutility management app). The goal is to create a **standalone, framework-agnostic, self-hostable** open-source project that can later have a cloud SaaS version built on top.

---

## ⚠️ IMPORTANT: Reference Implementation

The original production codebase is available at `/home/bimbobruno/git/decom-multiutility/decom-multiutility-api` (the root of this repository). **You MUST study it before writing any code.** It contains battle-tested logic that you need to port, not reinvent.

**Key files to read and understand first:**

### Extraction Engine (core logic):
- `decom-multiutility-api/api/src/main/java/applica/app/services/defaults/PersonaExtractionAgentService.java` — How documents are sent to the LLM, how responses are parsed, how base64 encoding works, how markdown fences are stripped. **Port this logic carefully.**
- `decom-multiutility-api/api/src/main/java/applica/app/services/defaults/DefaultExtractionsService.java` — Full extraction lifecycle: creation, indexing, schema inference, document processing, error handling, reindexing. **This is the orchestrator — study the flow.**
- `decom-multiutility-api/api/src/main/java/applica/app/services/defaults/DefaultExtractionResultsService.java` — MongoDB operations: inserting results, executing aggregation pipelines, injecting extraction_id filters. **Port the aggregation execution logic exactly.**

### Pipeline Generation (NL → MongoDB):
- `decom-multiutility-api/api/src/main/java/applica/app/services/defaults/PersonaAggregationPipelineAgentService.java` — How field schemas are built from sample records, how the prompt is constructed, how the pipeline JSON is validated. **The field schema building logic is critical.**
- `decom-multiutility-api/api/src/main/java/applica/app/services/defaults/DefaultAggregationsService.java` — Aggregation lifecycle, live aggregation flow.

### Agent Prompts (the "secret sauce"):
- `decom-multiutility-api/api/src/main/resources/agents/extraction-agent.md` — **Read this first.** This is the extraction prompt that has been refined in production. Port it to Python adapting format but preserving all rules and edge case handling.
- `decom-multiutility-api/api/src/main/resources/agents/aggregation-pipeline-agent.md` — The pipeline generation prompt. Same: port carefully, preserve all rules.
- `decom-multiutility-api/api/src/main/resources/agents/extraction-data-agent.md` — Template for per-extraction query agents. Use as reference for the chat agent.

### MCP Tools (query interface):
- `decom-multiutility-api/api/src/main/java/applica/app/services/mcp/tools/QueryExtractionTool.java` — How natural language queries are handled: get sample records, generate pipeline, execute, format results. **Port this flow for the /query endpoint.**
- `decom-multiutility-api/api/src/main/java/applica/app/services/mcp/tools/ListExtractionsTool.java` — Simple but useful reference.

### Domain Models:
- `decom-multiutility-api/api/src/main/java/applica/app/domain/aggregations/Extraction.java` — Extraction entity fields and statuses.
- `decom-multiutility-api/api/src/main/java/applica/app/domain/aggregations/Aggregation.java` — Aggregation entity.

### Frontend (UI reference):
- `decom-multiutility-web/src/components/ra-details/extraction-details/` — How the extraction detail page is structured.
- `decom-multiutility-web/src/hooks/extraction.jsx` — API hooks for extraction records.
- `decom-multiutility-web/src/hooks/aggregation.jsx` — API hooks for aggregation results and live queries.

**How to use the reference:**
- Read each file listed above before implementing its Python equivalent
- The Java code uses Persona SDK (proprietary) for LLM calls — replace with LiteLLM
- The Java code uses Applica CRUD framework for REST — replace with FastAPI
- The Java code uses Spring Data MongoDB — replace with motor (async MongoDB driver)
- The prompts in `resources/agents/` should be ported almost verbatim — they've been refined in production
- Pay special attention to error handling, edge cases, and the schema inference logic — these are the parts that took the most iteration to get right

---

## What Sifter Does (Product Perspective)

Sifter has two phases:

### Phase 1: Extraction
The user uploads documents (PDFs, images, scanned files) and writes natural language instructions like:
- "Extract: client name, invoice date, amount, VAT number"
- "Extract: contract start date, end date, monthly fee, parties involved"

Sifter processes each document through an AI model (vision-capable LLM), extracts the requested fields, and stores the structured results in MongoDB. The schema is **auto-inferred** from the first document if not provided explicitly.

### Phase 2: Query & Aggregation
Once data is extracted, the user can query it in natural language:
- "What's the total amount invoiced in December?"
- "Show me all invoices from supplier X sorted by date"
- "Average contract value by client"

Sifter converts natural language queries into MongoDB aggregation pipelines, executes them, and returns results. There's also a chat agent that wraps this functionality conversationally.

---

## Architecture to Build

### Tech Stack
- **Backend:** Python (FastAPI)
- **Database:** MongoDB (via motor async driver)
- **AI Integration:** LiteLLM (to support multiple LLM providers: OpenAI, Anthropic, Google, local models via Ollama)
- **File Processing:** PDF extraction via pymupdf (fitz), image support via base64 encoding
- **Frontend:** React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS + Lucide React + TanStack React Query
- **Deployment:** Docker Compose (MongoDB + API + Frontend)
- **Package:** Also publishable as a Python package (`pip install sifter-ai`)

### Why Python (not Java like the original)
The original codebase is Spring Boot/Java with proprietary dependencies (Persona SDK, Applica CRUD, Applica IAM). For an open-source product targeting developers, Python + FastAPI is the right choice: lower barrier to entry, larger AI/ML community, easier to contribute to, and LiteLLM gives instant multi-provider support.

---

## Project Structure

```
sifter/
├── README.md
├── LICENSE (Apache 2.0)
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── sifter/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # Configuration (env vars, defaults)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── extraction.py          # Extraction domain model
│   │   ├── extraction_result.py   # ExtractionResult model
│   │   └── aggregation.py         # Aggregation domain model
│   ├── services/
│   │   ├── __init__.py
│   │   ├── extraction_service.py      # Extraction lifecycle (create, reindex, process)
│   │   ├── extraction_agent.py        # AI extraction logic (LLM calls)
│   │   ├── extraction_results.py      # MongoDB results storage & query
│   │   ├── aggregation_service.py     # Aggregation lifecycle
│   │   ├── pipeline_agent.py          # NL -> MongoDB pipeline generation
│   │   └── file_processor.py          # File reading, PDF/image -> content
│   ├── api/
│   │   ├── __init__.py
│   │   ├── extractions.py         # REST endpoints for extractions
│   │   ├── aggregations.py        # REST endpoints for aggregations
│   │   └── chat.py                # Chat/conversational endpoint
│   ├── prompts/
│   │   ├── extraction.md          # Extraction agent system prompt
│   │   ├── aggregation_pipeline.md # Pipeline generation prompt
│   │   └── chat_agent.md          # Chat agent system prompt
│   └── sdk/
│       ├── __init__.py
│       └── client.py              # Python SDK client (for pip install usage)
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       │   ├── Extractions.jsx
│       │   ├── ExtractionDetail.jsx
│       │   └── Chat.jsx
│       └── components/
│           ├── ExtractionForm.jsx
│           ├── RecordsTable.jsx
│           ├── QueryInput.jsx
│           └── ChatInterface.jsx
├── tests/
│   ├── test_extraction_agent.py
│   ├── test_pipeline_agent.py
│   ├── test_extraction_service.py
│   └── test_api.py
└── examples/
    ├── quickstart.py
    ├── invoices/                   # Sample invoice PDFs for demo
    └── README.md
```

---

## Detailed Implementation Specifications

### 1. Configuration (`sifter/config.py`)

```python
from pydantic_settings import BaseSettings

class SifterConfig(BaseSettings):
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "sifter"
    
    # AI Provider (via LiteLLM)
    llm_model: str = "openai/gpt-4o"          # Default extraction model
    llm_api_key: str = ""                       # Provider API key
    pipeline_model: str = "openai/gpt-4o-mini"  # Pipeline generation (cheaper)
    
    # Extraction defaults
    extraction_temperature: float = 0.2         # Low for consistency
    max_concurrent_extractions: int = 5
    
    # File storage
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 50
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_prefix = "SIFTER_"
```

### 2. Domain Models

#### `Extraction` (MongoDB document)
```python
{
    "_id": ObjectId,
    "name": str,                        # User-given name
    "description": str,                 # Optional description
    "extraction_instructions": str,     # NL instructions: "Extract client, date, amount..."
    "extraction_schema": str | None,    # Auto-inferred or user-provided
    "status": "active" | "indexing" | "paused" | "error",
    "extraction_error": str | None,
    "processed_documents": int,
    "total_documents": int,
    "created_at": datetime,
    "updated_at": datetime
}
```

#### `ExtractionResult` (MongoDB document, collection: `extraction_results`)
```python
{
    "_id": ObjectId,
    "extraction_id": str,
    "document_id": str,                 # filename or unique ID
    "document_type": str,               # AI-detected: "invoice", "contract", etc.
    "confidence": float,                # 0.0 - 1.0
    "extracted_data": {                 # Dynamic key-value pairs
        "client": "Acme Corp",
        "date": "2024-12-15",
        "amount": 1500.00,
        ...
    },
    "created_at": datetime
}
# Compound index on (extraction_id, document_id)
```

#### `Aggregation` (MongoDB document)
```python
{
    "_id": ObjectId,
    "name": str,
    "description": str,
    "extraction_id": str,               # FK to extraction
    "aggregation_query": str,           # NL query
    "aggregation_pipeline": str | None, # Generated MongoDB pipeline JSON
    "aggregation_error": str | None,
    "status": "active" | "generating" | "error",
    "created_at": datetime,
    "updated_at": datetime
}
```

### 3. Extraction Agent (`sifter/services/extraction_agent.py`)

This is the core AI extraction logic. It takes a file and extraction instructions, calls an LLM, and returns structured data.

**Behavior (ported from the original `PersonaExtractionAgentService`):**

```python
async def extract(file_path: str, instructions: str, schema: str | None = None) -> ExtractionResult:
    """
    1. Read the file content:
       - PDF: extract text via pymupdf, also encode pages as base64 images for vision
       - Images (png, jpg): encode as base64
       - Other: read as text
    2. Build the prompt using the extraction system prompt (see prompts/extraction.md)
       - Include: file content, extraction instructions, schema (if available)
    3. Call LLM via LiteLLM with:
       - model: config.llm_model
       - temperature: 0.2
       - System prompt from prompts/extraction.md
       - User message with document content + instructions
    4. Parse JSON response
    5. Return ExtractionResult(document_type, matches_filter, confidence, extracted_data)
    """
```

**System prompt for extraction** (`prompts/extraction.md`):

Port from the original `extraction-agent.md`. Key rules:
- Output MUST be valid JSON with fields: documentType, matchesFilter, filterReason, confidence, extractedData
- Extract ONLY the fields specified in instructions
- Return null for fields not found in the document
- Numeric values as numbers, dates as ISO YYYY-MM-DD
- Keys must match extraction instructions exactly
- If a schema from previous extractions is provided, maintain consistency
- Confidence score: 1.0 = all fields found clearly, 0.5 = some fields uncertain, 0.0 = document doesn't match

### 4. Pipeline Agent (`sifter/services/pipeline_agent.py`)

Converts natural language queries into MongoDB aggregation pipelines.

**Behavior (ported from `PersonaAggregationPipelineAgentService`):**

```python
async def generate_pipeline(extraction_id: str, query: str, sample_records: list) -> str:
    """
    1. Build field schema from sample_records:
       For each field in extracted_data, note: field name, type, sample value
       Format: "- `field_name` (type=string, sample='Acme Corp')"
    2. Build prompt with query + field schema
    3. Call LLM via LiteLLM with:
       - model: config.pipeline_model (cheaper/faster model)
       - temperature: 0.2
       - System prompt from prompts/aggregation_pipeline.md
    4. Parse response as JSON array (MongoDB pipeline stages)
    5. Validate pipeline structure
    6. Return pipeline as JSON string
    """
```

**System prompt for pipeline generation** (`prompts/aggregation_pipeline.md`):

Port from the original `aggregation-pipeline-agent.md`. Key rules:
- Output MUST be a valid JSON array of MongoDB aggregation stages
- Do NOT include $match for extraction_id (the system adds it automatically)
- Reference extracted fields as: `$extracted_data.<fieldName>`
- Supported stages: $group, $sort, $project, $match, $unwind, $limit, $skip, $count
- Supported accumulators: $sum, $avg, $min, $max, $first, $last, $push, $addToSet
- For text matching: use $regex with $options: "i" (case-insensitive)
- Always strip markdown fences from response before parsing

### 5. Extraction Results Service (`sifter/services/extraction_results.py`)

MongoDB operations for extraction results.

**Key methods (ported from `DefaultExtractionResultsService`):**

```python
class ExtractionResultsService:
    COLLECTION = "extraction_results"
    
    async def ensure_indexes(self):
        # Create compound index on (extraction_id, document_id)
    
    async def insert_result(self, extraction_id, document_id, document_type, confidence, extracted_data):
        # Insert document into extraction_results collection
    
    async def get_results(self, extraction_id) -> list:
        # Find all results for extraction
    
    async def delete_by_extraction_id(self, extraction_id):
        # Delete all results for an extraction
    
    async def execute_aggregation(self, extraction_id, pipeline_json: str) -> list:
        """
        1. Parse pipeline_json as list of dicts
        2. Check if $match stage for extraction_id exists, add if missing
        3. Execute aggregation pipeline via motor
        4. Return results as list of dicts
        """
    
    async def count(self, extraction_id) -> int:
        # Count results for extraction
    
    async def export_csv(self, extraction_id) -> str:
        # Export all results as CSV string
```

### 6. Extraction Service (`sifter/services/extraction_service.py`)

Orchestrates the full extraction lifecycle.

**Key methods (ported from `DefaultExtractionsService`):**

```python
class ExtractionService:
    async def create(self, name, description, instructions, schema=None) -> Extraction:
        # Create extraction, set status=INDEXING
    
    async def process_documents(self, extraction_id, file_paths: list[str]):
        """
        1. Set status to INDEXING, count total documents
        2. For each file:
           a. Call extraction_agent.extract(file, instructions, schema)
           b. Store result via extraction_results.insert_result()
           c. Increment processed_documents
           d. If schema is None and this is first result, infer schema
        3. Set status to ACTIVE (or ERROR if failures)
        """
    
    async def reindex(self, extraction_id):
        # Delete all results, reprocess all documents
    
    async def process_single_document(self, extraction_id, file_path):
        # Process one new document and add to results
    
    async def remove_document(self, extraction_id, document_id):
        # Remove specific document results
    
    async def infer_schema(self, extracted_data: dict) -> str:
        """
        From first extraction result, generate schema string:
        "client (string), date (string), amount (number), vat_number (string)"
        """
    
    async def get_records(self, extraction_id) -> list:
        # Return all extracted records
```

### 7. REST API Endpoints

#### Extractions API (`sifter/api/extractions.py`)

```
POST   /api/extractions                          # Create new extraction
GET    /api/extractions                          # List all extractions
GET    /api/extractions/{id}                     # Get extraction details
DELETE /api/extractions/{id}                     # Delete extraction + results
POST   /api/extractions/{id}/upload              # Upload documents (multipart)
POST   /api/extractions/{id}/reindex             # Reindex all documents
POST   /api/extractions/{id}/reset               # Reset error state
GET    /api/extractions/{id}/records             # Get extracted records
GET    /api/extractions/{id}/records/csv         # Export as CSV
POST   /api/extractions/{id}/query               # Natural language query (live aggregation)
```

#### Aggregations API (`sifter/api/aggregations.py`)

```
POST   /api/aggregations                         # Create saved aggregation
GET    /api/aggregations                         # List aggregations
GET    /api/aggregations/{id}                    # Get aggregation details
GET    /api/aggregations/{id}/result             # Execute and return result
DELETE /api/aggregations/{id}                    # Delete aggregation
```

#### Chat API (`sifter/api/chat.py`)

```
POST   /api/chat                                 # Send message, get response
       Body: { "message": "How much did I invoice in December?", "extraction_id": "optional" }
       Response: { "response": "Based on the data...", "data": [...] }
```

The chat endpoint is a lightweight agent that:
1. Determines if the question is about extraction data
2. If yes: identifies the right extraction, generates pipeline, executes, formats response
3. If no: responds conversationally

### 8. Python SDK (`sifter/sdk/client.py`)

This is the developer-facing interface for programmatic use:

```python
from sifter import Sifter

# Initialize
s = Sifter(
    mongodb_uri="mongodb://localhost:27017",
    llm_model="openai/gpt-4o",
    llm_api_key="sk-..."
)

# Create extraction
ext = s.create_extraction(
    name="December Invoices",
    instructions="Extract: client name, invoice date, total amount, VAT number"
)

# Upload and process documents
ext.add_documents("./invoices/december/")  # Directory or file path(s)
ext.wait()  # Wait for processing to complete

# Query results
results = ext.query("Total amount by client")
print(results)

# Get raw records
records = ext.records()

# Export
ext.export_csv("./output.csv")
```

The SDK should be a thin wrapper around the REST API, but also support **direct mode** (no server needed — directly calls MongoDB and LLM):

```python
# Direct mode (no server needed)
s = Sifter(
    mongodb_uri="mongodb://localhost:27017",
    llm_model="openai/gpt-4o",
    llm_api_key="sk-...",
    mode="direct"  # No FastAPI server, direct function calls
)
```

### 9. Frontend (Admin UI)

**Stack:**
- **React 18** + **Vite** (build tool)
- **shadcn/ui** (component library — use `npx shadcn@latest init` then add components as needed)
- **Tailwind CSS** (styling, configured by shadcn init)
- **Lucide React** (icons — `lucide-react`)
- **TanStack React Query** (server state, caching, polling — `@tanstack/react-query`)
- **React Router** (routing — `react-router-dom`)

**Architecture principles:**
- **Everything behind API calls + React hooks.** No direct data manipulation in components.
- Create a `src/api/` folder with one file per resource (extractions.ts, aggregations.ts, chat.ts) containing fetch functions.
- Create a `src/hooks/` folder wrapping every API call in a React Query hook (useExtractions, useExtraction, useExtractionRecords, useCreateExtraction, useUploadDocuments, useQueryExtraction, etc.)
- Components only consume hooks, never call fetch directly.
- Use React Query's `useMutation` for all write operations (create, upload, reindex, delete).
- Use React Query's `useQuery` with polling (`refetchInterval`) for extraction progress during indexing.

**Custom hooks pattern:**

```typescript
// src/api/extractions.ts
export const fetchExtractions = async (): Promise<Extraction[]> => {
  const res = await fetch("/api/extractions");
  return res.json();
};

export const fetchExtractionRecords = async (id: string): Promise<Record[]> => {
  const res = await fetch(`/api/extractions/${id}/records`);
  return res.json();
};

export const queryExtraction = async (id: string, query: string): Promise<QueryResult> => {
  const res = await fetch(`/api/extractions/${id}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json();
};

// src/hooks/useExtractions.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const useExtractions = () =>
  useQuery({ queryKey: ["extractions"], queryFn: fetchExtractions });

export const useExtraction = (id: string) =>
  useQuery({ queryKey: ["extraction", id], queryFn: () => fetchExtraction(id) });

export const useExtractionRecords = (id: string) =>
  useQuery({ queryKey: ["extraction-records", id], queryFn: () => fetchExtractionRecords(id) });

export const useQueryExtraction = () => {
  return useMutation({ mutationFn: ({ id, query }: { id: string; query: string }) => queryExtraction(id, query) });
};

export const useUploadDocuments = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, files }: { id: string; files: FormData }) => uploadDocuments(id, files),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["extraction", id] });
    },
  });
};
```

**shadcn/ui components to use:**
- `Button`, `Input`, `Textarea` — forms
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` — data display
- `Card`, `CardHeader`, `CardContent` — layout
- `Badge` — extraction status (active/indexing/error)
- `Progress` — indexing progress bar
- `Dialog` — create extraction modal
- `DropdownMenu` — actions menu (reindex, export, delete)
- `Tabs` — switch between Records / Query / Chat on extraction detail
- `ScrollArea` — chat message list
- `Skeleton` — loading states
- `Alert` — error display
- `Tooltip` — action buttons

**Pages:**

**1. Extractions List (`/`)**
- shadcn `Table` with columns: Name, Status (Badge), Documents (count), Created
- "New Extraction" Button opens Dialog with form: name, description, instructions
- Each row clickable → navigates to detail
- Lucide icons: `Plus`, `FileText`, `Loader2` (for indexing spinner)

**2. Extraction Detail (`/extractions/:id`)**
- `Card` header with name, description, extraction instructions, inferred schema
- Action buttons row: Upload More (`Upload` icon), Reindex (`RefreshCw`), Export CSV (`Download`), Delete (`Trash2`)
- `Progress` bar visible during indexing (polled via React Query refetchInterval)
- `Tabs` component with 3 tabs:
  - **Records**: shadcn `Table` with dynamic columns from extracted_data keys. Sortable.
  - **Query**: `Textarea` input + "Run Query" Button. Results displayed in `Table` below. Uses `useQueryExtraction` mutation.
  - **Chat**: Simple chat interface. Input at bottom, messages scroll up. User messages right-aligned, AI responses left-aligned with optional data tables inline.

**3. Chat Page (`/chat`)**
- Full-page chat interface
- Dropdown to select extraction (optional — can auto-detect)
- `ScrollArea` for messages
- Input bar at bottom with send button
- Streaming responses (show text arriving progressively)
- When response includes data, render inline `Table`

**Frontend project structure:**
```
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── components.json              # shadcn config
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx                  # Router + QueryClientProvider
    ├── api/
    │   ├── extractions.ts       # API fetch functions
    │   ├── aggregations.ts
    │   └── chat.ts
    ├── hooks/
    │   ├── useExtractions.ts    # React Query hooks
    │   ├── useAggregations.ts
    │   └── useChat.ts
    ├── pages/
    │   ├── ExtractionsPage.tsx
    │   ├── ExtractionDetailPage.tsx
    │   └── ChatPage.tsx
    ├── components/
    │   ├── ExtractionForm.tsx   # Create/edit extraction dialog
    │   ├── RecordsTable.tsx     # Dynamic table for extraction results
    │   ├── QueryPanel.tsx       # NL query input + results
    │   ├── ChatInterface.tsx    # Chat messages + input
    │   ├── StatusBadge.tsx      # Extraction status badge
    │   └── ProgressBar.tsx      # Indexing progress
    ├── lib/
    │   └── utils.ts             # shadcn utils (cn helper)
    └── components/ui/           # shadcn generated components
```

**TypeScript is required.** Use proper types for all API responses and component props.

### 10. Docker Compose

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - sifter-data:/data/db
  
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - SIFTER_MONGODB_URI=mongodb://mongodb:27017
      - SIFTER_LLM_MODEL=openai/gpt-4o
      - SIFTER_LLM_API_KEY=${SIFTER_LLM_API_KEY}
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - mongodb
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  sifter-data:
```

---

## README.md Content

Write a compelling README with:

1. **Hero section**: Logo placeholder + "Sifter: Turn your documents into a queryable database" + badges (license, Python version, Docker)

2. **30-second demo**: Show the SDK usage (3-5 lines of code) with a clear before/after — "50 invoices in a folder" → "structured data you can query"

3. **Features list**: 
   - AI-powered extraction with natural language instructions
   - Auto schema inference
   - Natural language querying (NL → MongoDB aggregation)
   - Multi-provider LLM support (OpenAI, Anthropic, Google, Ollama)
   - REST API + Python SDK
   - Admin UI included
   - Self-hostable with Docker Compose

4. **Quick Start**: 
   - `pip install sifter-ai` for SDK-only
   - `docker compose up` for full stack
   - 5-line code example

5. **Supported file types**: PDF, PNG, JPG, TIFF (via vision models)

6. **Configuration**: Environment variables table

7. **API Reference**: Link to docs (placeholder)

8. **Contributing**: Standard open-source contributing guide

9. **License**: Apache 2.0

---

## Key Differences from Original Codebase

| Aspect | Original (decom-multiutility) | Sifter |
|--------|-------------------------------|--------|
| Language | Java 17 / Spring Boot | Python 3.11+ / FastAPI |
| AI SDK | Persona SDK (proprietary) | LiteLLM (open, multi-provider) |
| Auth | Applica IAM | API key-based (simple) |
| CRUD | Applica CRUD framework | Direct MongoDB via motor |
| Storage | GCS (Google Cloud Storage) | Local filesystem (extensible) |
| MCP | Spring MCP integration | Not needed (direct API) |
| Multi-agent | Orchestrator + specialized agents | Simpler: extraction agent + pipeline agent + chat agent |
| Deployment | GKE + Terraform | Docker Compose |
| Frontend | React Admin (Applica) | Vanilla React + Tailwind |

---

## Development Order

Build in this order:

1. **Project scaffolding**: pyproject.toml, directory structure, config, Docker Compose
2. **MongoDB models & service**: extraction_results.py with insert, query, aggregate
3. **File processor**: Read PDFs and images, encode for LLM
4. **Extraction agent**: LiteLLM integration, extraction prompt, JSON parsing
5. **Extraction service**: Full lifecycle (create, process, reindex, schema inference)
6. **Pipeline agent**: NL → MongoDB pipeline generation
7. **Aggregation service**: Saved aggregations + live queries
8. **REST API**: All endpoints via FastAPI
9. **Python SDK**: Client wrapper
10. **Chat endpoint**: Simple conversational agent
11. **Frontend**: React UI
12. **README & examples**: Documentation, sample files, quickstart
13. **Tests**: Unit tests for agents, integration tests for API
14. **Docker**: Dockerfile, docker-compose, health checks

---

## Quality Requirements

- Type hints everywhere (Python)
- Async/await throughout (FastAPI + motor)
- Proper error handling with meaningful error messages
- Logging with structlog
- Input validation with Pydantic
- CORS enabled for frontend
- Health check endpoint (`/health`)
- OpenAPI docs auto-generated by FastAPI (`/docs`)
- Clean, readable code — this is open-source, people will read it

---

## Sample Prompts to Include

Include the actual agent prompts as markdown files in `sifter/prompts/`. These are critical — they're the "secret sauce" of the product. Port them carefully from the original (adapting format but keeping the logic):

### extraction.md
The extraction agent prompt that instructs the LLM how to extract data from documents. Must include:
- Strict JSON output format
- Field consistency rules
- Confidence scoring guidelines
- Null handling for missing fields
- Date/number formatting rules

### aggregation_pipeline.md
The pipeline generation prompt. Must include:
- MongoDB aggregation pipeline syntax rules
- Available stages and accumulators
- Field reference format ($extracted_data.<field>)
- Case-insensitive regex hints
- Instruction to NOT include extraction_id filter

### chat_agent.md
A new prompt for the chat agent. Should:
- Determine if the question is about data
- Choose the right extraction to query
- Format results in natural language
- Handle follow-up questions
- Be friendly and concise
