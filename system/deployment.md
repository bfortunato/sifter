---
title: Deployment
status: synced
---

# Deployment

## Deployment Methods

### 1. Development (run.sh)

The `code/run.sh` script starts the full stack locally for development:

1. Starts a MongoDB container (`sifter-mongo`) via Docker
2. Installs Python deps with `uv sync`
3. Starts the FastAPI backend on `http://localhost:8000` with `--reload`
4. Builds frontend deps with `npm install` if needed
5. Starts the Vite dev server on `http://localhost:3000`

Requirements: `uv`, `npm`, `docker`

### 2. Docker Compose (production-ready)

`code/docker-compose.yml` defines three services:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `mongodb` | mongo:7 | 27017 | Persistent database with healthcheck |
| `api` | built from `code/Dockerfile` | 8000 | FastAPI backend |
| `frontend` | built from `code/frontend/Dockerfile` | 3000 | Nginx serving React SPA |

The API service receives all `SIFTER_*` env vars. File uploads are persisted via `./uploads` volume mount (filesystem backend only).

Start with:
```bash
cp code/.env.example code/.env  # edit with your keys
docker compose -f code/docker-compose.yml up -d
```

### 3. Separate containers (cloud deployment)

The API and frontend can be deployed independently:
- **API**: push the `Dockerfile` image to any container registry; run with MongoDB URI pointing to a managed instance (Atlas, DocumentDB, etc.)
- **Frontend**: the `frontend/Dockerfile` produces a static build served by nginx. Can alternatively be deployed to Vercel/Netlify by building `code/frontend` and serving the `dist/` output.

### 4. SDK only (no UI)

The Python SDK (`pip install sifter-ai`) only requires the API container. The frontend is optional.

## Docker Images

### API (`code/Dockerfile`)

- Base: `python:3.12-slim`
- Uses `uv` for dependency installation from lockfile (`uv sync --no-dev --frozen`)
- Installs `libmupdf-dev` for PDF processing
- Copies `sifter/` source and optional `frontend/dist/` (served as static files if present)
- Exposes port 8000
- CMD: `uv run python -m sifter.main`

### Frontend (`code/frontend/Dockerfile`)

- Multi-stage: `node:20-alpine` builder → `nginx:alpine` server
- Stage 1: `npm install && npm run build` → `dist/`
- Stage 2: copies dist to `/usr/share/nginx/html`, uses custom `nginx.conf`
- Exposes port 3000

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

Three workflows in `.github/workflows/`:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | Push/PR to main | Runs Python tests against a real MongoDB service container; TypeScript typecheck |
| `docker.yml` | Push to main or semver tag | Builds and pushes API + frontend images to GitHub Container Registry (`ghcr.io`) |
| `docs.yml` | Push to main (docs/ changed) | Builds VitePress docs and deploys to GitHub Pages |

### Image tagging (`docker.yml`)

- Branch pushes: tagged as `main` (or branch name)
- Semver tags (`v1.2.3`): tagged as `1.2.3` and `1.2`
- All builds also get a `sha-<commit>` tag for traceability

## Production Checklist

- [ ] Set `SIFTER_JWT_SECRET` to a random 64-char string
- [ ] Set `SIFTER_API_KEY` to a strong random value
- [ ] Use a managed MongoDB instance (Atlas, DocumentDB, etc.) with auth
- [ ] Set `SIFTER_CORS_ORIGINS` to your frontend domain
- [ ] Put the API behind a reverse proxy (nginx, Caddy) with TLS
- [ ] **Filesystem backend**: mount `SIFTER_STORAGE_PATH` to a persistent volume
- [ ] **S3/GCS backend**: set `SIFTER_STORAGE_BACKEND` + credentials; no volume needed
- [ ] Set `SIFTER_MAX_WORKERS` based on available CPU cores
- [ ] Rotate JWT secret and all API keys after initial deployment
