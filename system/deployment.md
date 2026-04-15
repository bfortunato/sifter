---
title: Deployment
status: synced
---

# Deployment

## Deployment Methods

### 1. Development (run.sh)

`code/server/run.sh` starts the API stack locally:

1. Starts a MongoDB container (`sifter-mongo`) via Docker
2. Installs Python deps with `uv sync` if `.venv` is missing
3. Starts FastAPI on `http://localhost:8000` with `--reload`

Requirements: `uv`, `docker`

```bash
cd code/server
cp .env.example .env   # edit SIFTER_LLM_API_KEY
./run.sh
```

To also run the frontend in dev:
```bash
cd code/frontend
npm install && npm run dev   # Vite on :3000
```

### 2. Docker Compose (production-ready)

`code/server/docker-compose.yml` defines two services:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `mongodb` | mongo:7 | 27017 | Persistent database with healthcheck |
| `api` | built from `code/server/Dockerfile` | 8000 | FastAPI backend + React UI |

Start with:
```bash
cp code/server/.env.example code/server/.env
docker compose -f code/server/docker-compose.yml up -d
```

### 3. SDK only

The Python SDK (`pip install sifter-ai`) only requires the API to be running.

## Docker Image

### API (`code/server/Dockerfile`)

- Base: `python:3.12-slim`
- Uses `uv` for dependency installation from lockfile (`uv sync --no-dev --frozen`)
- Installs `libmupdf-dev` for PDF processing
- Exposes port 8000

## Environment Variables

All variables use the `SIFTER_` prefix (via pydantic-settings).

| Variable | Default | Description |
|----------|---------|-------------|
| `SIFTER_LLM_API_KEY` | *(required)* | LLM provider API key |
| `SIFTER_LLM_MODEL` | `openai/gpt-4o` | LiteLLM model string for extraction |
| `SIFTER_PIPELINE_MODEL` | `openai/gpt-4o-mini` | Faster model for aggregation pipelines |
| `SIFTER_MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `SIFTER_MONGODB_DATABASE` | `sifter` | Database name |
| `SIFTER_API_KEY` | `sk-dev` | Bootstrap API key — **change in production** |
| `SIFTER_REQUIRE_API_KEY` | `false` | If `true`, unauthenticated requests return 401 |
| `SIFTER_JWT_SECRET` | `dev-secret-...` | **Change in production** — random 64-char string |
| `SIFTER_JWT_EXPIRE_MINUTES` | `1440` | JWT TTL (24h default) |
| `SIFTER_STORAGE_BACKEND` | `filesystem` | Storage backend: `filesystem`, `s3`, or `gcs` |
| `SIFTER_STORAGE_PATH` | `./uploads` | Base path for filesystem backend |
| `SIFTER_MAX_FILE_SIZE_MB` | `50` | Maximum upload size |
| `SIFTER_MAX_WORKERS` | `4` | Concurrent document processing workers |
| `SIFTER_HOST` | `0.0.0.0` | Bind address |
| `SIFTER_PORT` | `8000` | Server port |
| `SIFTER_CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins |

### S3 Storage (`SIFTER_STORAGE_BACKEND=s3`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SIFTER_S3_BUCKET` | *(required)* | S3 bucket name |
| `SIFTER_S3_REGION` | `us-east-1` | AWS region |
| `SIFTER_S3_ACCESS_KEY_ID` | *(required)* | AWS access key |
| `SIFTER_S3_SECRET_ACCESS_KEY` | *(required)* | AWS secret key |
| `SIFTER_S3_ENDPOINT_URL` | *(optional)* | Custom endpoint (MinIO, R2, etc.) |

### GCS Storage (`SIFTER_STORAGE_BACKEND=gcs`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SIFTER_GCS_BUCKET` | *(required)* | GCS bucket name |
| `SIFTER_GCS_PROJECT` | *(required)* | GCP project ID |
| `SIFTER_GCS_CREDENTIALS_FILE` | *(optional)* | Path to service account JSON; omit to use ADC |

## CI/CD (GitHub Actions)

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | Push/PR to main | Runs Python tests against a real MongoDB service container |
| `docker.yml` | Push to main or semver tag | Builds and pushes API image to GitHub Container Registry |

## Production Checklist

- [ ] Set `SIFTER_JWT_SECRET` to a random 64-char string
- [ ] Set `SIFTER_API_KEY` to a strong random value
- [ ] Use a managed MongoDB instance (Atlas, DocumentDB) with auth
- [ ] Set `SIFTER_CORS_ORIGINS` to the sifter-cloud frontend domain
- [ ] Put the API behind a reverse proxy (nginx, Caddy) with TLS
- [ ] **Filesystem backend**: mount `SIFTER_STORAGE_PATH` to a persistent volume
- [ ] **S3/GCS backend**: set `SIFTER_STORAGE_BACKEND` + credentials; no volume needed
- [ ] Set `SIFTER_MAX_WORKERS` based on available CPU cores
